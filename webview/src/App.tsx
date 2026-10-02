import { wktToGeoJSON } from '@terraformer/wkt'
import * as LL from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer } from 'react-leaflet'
import { WebviewApi } from 'vscode-webview'
import { type MsgFromWebview, type MsgToWebview, type SourceDocument, type TextRange, type ViewingCommand, type ViewingScope, type WktToken } from '@wkt-viewer/shared'
import { GeomObjectsList } from './GeomObjectsList'
import { GeomObjectsMap } from './GeomObjectsMap'
import { MapErrorBoundary } from './MapErrorBoundary'
import { ViewerHeader } from './ViewerHeader'
import './App.css'

export type GeomObject = {
    id: number
    token: WktToken
    feature: GeoJSON.Feature
}

const MAP_MIN_ZOOM = -10
let vsCodeApi: WebviewApi<unknown> | null = null

function getVsCodeApi() {
    return vsCodeApi ??= acquireVsCodeApi()
}

function postMsgToVscode(msg: MsgFromWebview) {
    getVsCodeApi().postMessage(msg)
}

export function wktTokensToGeomObjects(wktTokens: WktToken[]): GeomObject[] {
    return wktTokens.flatMap(token => {
        try {
            const geometry = wktToGeoJSON(token.wkt)
            if (!geometry) return []
            return [{
                id: token.start,
                token,
                feature: { type: 'Feature', geometry: geometry as GeoJSON.Geometry, properties: {} },
            }]
        } catch {
            return []
        }
    })
}

export function findSelectedGeomObject(
    geomObjects: GeomObject[],
    start: number,
    scope: ViewingScope,
): GeomObject | null {
    return geomObjects.find(object => containsTokenOrAnnotationOffset(object.token, start, scope)) ?? null
}

function containsTokenOrAnnotationOffset(token: WktToken, start: number, scope: ViewingScope): boolean {
    if (token.start <= start && token.end > start) return true

    const annotation = token.annotation
    const ranges = scope.kind === 'area' ? [scope] : scope.kind === 'selection' ? scope.ranges : []
    const annotationIsInScope = scope.kind === 'document'
        || (annotation !== undefined && ranges.some(range => annotation.start >= range.start && annotation.end <= range.end))
    return annotation !== undefined && annotationIsInScope && annotation.start <= start && annotation.end > start
}

export function findSelectedGeomObjects(geomObjects: GeomObject[], ranges: TextRange[], scope: ViewingScope): GeomObject[] {
    return geomObjects.filter(object => ranges.some(range =>
        (range.start < range.end && object.token.start >= range.start && object.token.end <= range.end)
        || containsTokenOrAnnotationOffset(object.token, range.start, scope)))
}

export default function App() {
    const [geomObjects, setGeomObjects] = useState<GeomObject[]>([])
    const geomObjectsRef = useRef<GeomObject[]>([])
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [source, setSource] = useState<SourceDocument | null>(null)
    const sourceRef = useRef<SourceDocument | null>(null)
    const [scope, setScope] = useState<ViewingScope>({ kind: 'document' })
    const scopeRef = useRef<ViewingScope>({ kind: 'document' })
    const [viewLocked, setViewLocked] = useState(false)
    const [areaLineRange, setAreaLineRange] = useState<{ start: number, end: number }>()
    const [fitId, setFitId] = useState(0)
    const [listFocusId, setListFocusId] = useState(0)
    const [listFitId, setListFitId] = useState(0)

    useEffect(() => {
        const onMessage = (event: MessageEvent<MsgToWebview>) => {
            const message = event.data
            if (message.command === 'update') {
                const nextGeomObjects = wktTokensToGeomObjects(message.wkt)
                // Keep event handling consistent even if VS Code immediately follows with select.
                geomObjectsRef.current = nextGeomObjects
                const preserveSelection = sourceRef.current?.uri === message.source.uri
                    && sourceRef.current.version === message.source.version
                sourceRef.current = message.source
                scopeRef.current = message.scope
                setGeomObjects(nextGeomObjects)
                setSelectedId(selectedId => preserveSelection && nextGeomObjects.some(object => object.id === selectedId)
                    ? selectedId
                    : null)
                setSelectedIds(ids => preserveSelection ? ids.filter(id => nextGeomObjects.some(object => object.id === id)) : [])
                setSource(message.source)
                setScope(message.scope)
                setViewLocked(message.viewLocked)
                setAreaLineRange(message.areaLineRange)
                setFitId(message.fitId)
                return
            }

            if (message.command === 'select') {
                if (sourceRef.current?.uri !== message.source.uri || sourceRef.current.version !== message.source.version) return
                const objects = findSelectedGeomObjects(geomObjectsRef.current, message.ranges, scopeRef.current)
                setSelectedIds(objects.map(object => object.id))
                const primary = findSelectedGeomObject(geomObjectsRef.current, message.ranges[0]?.start ?? -1, scopeRef.current)
                setSelectedId(primary?.id ?? objects[0]?.id ?? null)
            }
        }

        window.addEventListener('message', onMessage)
        postMsgToVscode({ command: 'ready' })
        return () => window.removeEventListener('message', onMessage)
    }, [])

    const selectObjects = useCallback((objects: GeomObject[], focus: GeomObject) => {
        if (!source) return
        const ranges = objects.map(object => ({ start: object.token.start, end: object.token.end }))
        setSelectedIds(objects.map(object => object.id))
        setSelectedId(focus.id)
        postMsgToVscode({
            command: 'select',
            ranges,
            source,
        })
    }, [source])

    const handleSelect = useCallback((object: GeomObject) => selectObjects([object], object), [selectObjects])

    const handleListSelect = useCallback((objects: GeomObject[], focus: GeomObject) => {
        selectObjects(objects, focus)
        setListFocusId(id => id + 1)
    }, [selectObjects])

    const handleListFit = useCallback((object: GeomObject) => {
        handleSelect(object)
        setListFitId(id => id + 1)
    }, [handleSelect])

    const sendViewerCommand = useCallback((command: ViewingCommand) => {
        if (source) postMsgToVscode({ ...command, source })
    }, [source])

    const selectedRanges = geomObjects.filter(object => selectedIds.includes(object.id))
        .map(object => ({ start: object.token.start, end: object.token.end }))

    return (
        <div className="viewer">
            <aside className="sidebar">
                <ViewerHeader
                    source={source}
                    scope={scope}
                    viewLocked={viewLocked}
                    selectedRanges={selectedRanges}
                    visibleCount={geomObjects.length}
                    areaLineRange={areaLineRange}
                    onCommand={sendViewerCommand}
                />
                {scope.kind !== 'document' && geomObjects.length === 0 && <p className="empty-area">Inga WKT-geometrier i urvalet</p>}
                <GeomObjectsList
                    geomObjects={geomObjects}
                    selectedId={selectedId}
                    selectedIds={selectedIds}
                    sourceUri={source?.uri}
                    onSelect={handleListSelect}
                    onFit={handleListFit}
                />
            </aside>
            <div className="map-container">
                <MapErrorBoundary fitId={fitId}>
                    <MapContainer
                        crs={LL.CRS.Simple}
                        center={[0, 0]}
                        zoom={0}
                        style={{ height: '100%', width: '100%' }}
                        minZoom={MAP_MIN_ZOOM}
                    >
                        <GeomObjectsMap
                            geomObjects={geomObjects}
                            selectedId={selectedId}
                            selectedIds={selectedIds}
                            onSelect={handleSelect}
                            fitId={fitId}
                            listFocusId={listFocusId}
                            listFitId={listFitId}
                        />
                    </MapContainer>
                </MapErrorBoundary>
            </div>
        </div>
    )
}
