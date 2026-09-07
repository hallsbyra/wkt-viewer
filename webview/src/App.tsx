import { wktToGeoJSON } from '@terraformer/wkt'
import * as LL from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer } from 'react-leaflet'
import { WebviewApi } from 'vscode-webview'
import { type MsgFromWebview, type MsgToWebview, type SourceDocument, type ViewingScope, type WktToken } from '@wkt-viewer/shared'
import { GeomObjectsList } from './GeomObjectsList'
import { GeomObjectsMap } from './GeomObjectsMap'

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
    const annotationIsInScope = scope.kind === 'document'
        || (annotation !== undefined && annotation.start >= scope.start && annotation.end <= scope.end)
    return annotation !== undefined && annotationIsInScope && annotation.start <= start && annotation.end > start
}

export default function App() {
    const [geomObjects, setGeomObjects] = useState<GeomObject[]>([])
    const geomObjectsRef = useRef<GeomObject[]>([])
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [source, setSource] = useState<SourceDocument | null>(null)
    const sourceRef = useRef<SourceDocument | null>(null)
    const [scope, setScope] = useState<ViewingScope>({ kind: 'document' })
    const scopeRef = useRef<ViewingScope>({ kind: 'document' })
    const [captureAvailable, setCaptureAvailable] = useState(false)
    const [areaLineRange, setAreaLineRange] = useState<{ start: number, end: number }>()
    const [fitId, setFitId] = useState(0)

    useEffect(() => {
        const onMessage = (event: MessageEvent<MsgToWebview>) => {
            const message = event.data
            if (message.command === 'update') {
                const nextGeomObjects = wktTokensToGeomObjects(message.wkt)
                // Keep event handling consistent even if VS Code immediately follows with select.
                geomObjectsRef.current = nextGeomObjects
                sourceRef.current = message.source
                scopeRef.current = message.scope
                setGeomObjects(nextGeomObjects)
                setSelectedId(null)
                setSource(message.source)
                setScope(message.scope)
                setCaptureAvailable(message.captureAvailable)
                setAreaLineRange(message.areaLineRange)
                setFitId(message.fitId)
                return
            }

            if (message.command === 'select') {
                if (sourceRef.current?.uri !== message.source.uri || sourceRef.current.version !== message.source.version) return
                const selectedObject = findSelectedGeomObject(geomObjectsRef.current, message.start, scopeRef.current)
                setSelectedId(selectedObject?.id ?? null)
                setCaptureAvailable(message.captureAvailable)
            }
        }

        window.addEventListener('message', onMessage)
        postMsgToVscode({ command: 'ready' })
        return () => window.removeEventListener('message', onMessage)
    }, [])

    const handleSelect = useCallback((object: GeomObject) => {
        if (!source) return

        setSelectedId(object.id)
        postMsgToVscode({
            command: 'select',
            start: object.token.start,
            end: object.token.end,
            source,
        })
    }, [source])

    const sendScopeRequest = useCallback((command: 'captureArea' | 'showDocument' | 'fitAll') => {
        if (source) postMsgToVscode({ command, source })
    }, [source])

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
            <div style={sidePanelStyle}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <button
                        onClick={() => sendScopeRequest('showDocument')}
                        aria-pressed={scope.kind === 'document'}
                        style={scopeButtonStyle(scope.kind === 'document')}
                    >
                        Hela dokumentet
                    </button>
                    <button
                        onClick={() => sendScopeRequest('captureArea')}
                        disabled={!captureAvailable}
                        aria-pressed={scope.kind === 'area'}
                        style={scopeButtonStyle(scope.kind === 'area')}
                    >
                        Aktuellt område
                    </button>
                </div>
                {source && <div style={{ fontSize: 12, marginBottom: 8, color: '#555' }}>
                    {scope.kind === 'area' && areaLineRange
                        ? `${source.filename} · Rader ${areaLineRange.start}–${areaLineRange.end} · ${geomObjects.length} geometrier`
                        : `${source.filename} · ${geomObjects.length} geometrier`}
                </div>}
                <button onClick={() => sendScopeRequest('fitAll')} style={{ marginBottom: 8 }}>
                    Visa alla i bild
                </button>
                {scope.kind === 'area' && geomObjects.length === 0 && <p>Inga WKT-geometrier i området</p>}
                <GeomObjectsList geomObjects={geomObjects} selectedId={selectedId} onSelect={handleSelect} />
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
                <MapContainer
                    crs={LL.CRS.Simple}
                    style={{ height: '100%', width: '100%' }}
                    minZoom={MAP_MIN_ZOOM}
                    maxBounds={[[-Infinity, -Infinity], [Infinity, Infinity]]}
                >
                    <GeomObjectsMap geomObjects={geomObjects} selectedId={selectedId} onSelect={handleSelect} fitId={fitId} />
                </MapContainer>
            </div>
        </div>
    )
}

const sidePanelStyle = {
    width: 320,
    background: '#f9f9f9',
    borderRight: '1px solid #eee',
    overflow: 'hidden',
    padding: 8,
    boxSizing: 'border-box' as const,
    display: 'flex',
    flexDirection: 'column' as const,
}

function scopeButtonStyle(active: boolean) {
    return active
        ? { background: '#007acc', color: '#fff', borderColor: '#005a9e', fontWeight: 600 }
        : undefined
}
