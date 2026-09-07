import { wktToGeoJSON } from '@terraformer/wkt'
import * as LL from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useState } from 'react'
import { MapContainer } from 'react-leaflet'
import { WebviewApi } from 'vscode-webview'
import { type MsgFromWebview, type MsgToWebview, type SourceDocument, type ViewingScope, type WktToken } from '@wkt-viewer/shared'
import { GeomObjectsList } from './GeomObjectsList'
import { GeomObjectsMap } from './GeomObjectsMap'
import { useLatest } from './react-util'

export type GeomObject = {
    id: number
    token: WktToken
    feature: GeoJSON.Feature
}

const MAP_MIN_ZOOM = -10

let vsCodeApi: WebviewApi<unknown> | null = null
const getVsCodeApi = () => (vsCodeApi ??= acquireVsCodeApi())

function postMsgToVscode(msg: MsgFromWebview) {
    console.log('Posting message to VSCode:', msg)
    getVsCodeApi().postMessage(msg)
}

export function wktTokensToGeomObjects(wktTokens: WktToken[]): GeomObject[] {
    return wktTokens.flatMap(wktToken => {
        let geojson: ReturnType<typeof wktToGeoJSON>
        try {
            geojson = wktToGeoJSON(wktToken.wkt)
        } catch {
            // Source code can contain lookalikes such as Point(0, 4).
            // A failed candidate must not prevent valid geometries from rendering.
            return []
        }
        if (!geojson) return []
        return [{
            id: wktToken.start,
            token: wktToken,
            feature: { type: 'Feature', geometry: geojson as GeoJSON.Geometry, properties: {} },
        }]
    })
}

export function findSelectedGeomObject(geomObjects: GeomObject[], start: number, line: number): GeomObject | null {
    void line
    return geomObjects.find(obj => containsTokenOrAnnotationOffset(obj.token, start)) ?? null
}

function containsTokenOrAnnotationOffset(token: WktToken, start: number): boolean {
    if (token.start <= start && token.end > start) return true

    const annotation = token.annotation
    return annotation !== undefined && annotation.start <= start && annotation.end > start
}

export default function App() {
    const [geomObjects, setGeomObjects] = useState<GeomObject[]>([])
    const geomObjectsRef = useLatest(geomObjects)
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [source, setSource] = useState<SourceDocument | null>(null)
    const sourceRef = useLatest(source)
    const [scope, setScope] = useState<ViewingScope>({ kind: 'document' })
    const [captureAvailable, setCaptureAvailable] = useState(false)
    const [areaLineRange, setAreaLineRange] = useState<{ start: number, end: number } | undefined>()
    const [fitId, setFitId] = useState(0)

    // --- VSCode Message Listener ---
    useEffect(() => {
        function onMessage(msg: MessageEvent<MsgToWebview>) {
            try {
                if (msg.data.command === 'update') {
                    console.log(`'update' message received`, msg.data.wkt)
                    setGeomObjects(wktTokensToGeomObjects(msg.data.wkt))
                    setSelectedId(null)
                    setSource(msg.data.source ?? null)
                    setScope(msg.data.scope ?? { kind: 'document' })
                    setCaptureAvailable(msg.data.captureAvailable ?? false)
                    setAreaLineRange(msg.data.areaLineRange)
                    setFitId(msg.data.fitId)
                } else if (msg.data.command === 'select') {
                    if (sourceRef.current?.uri !== msg.data.source.uri || sourceRef.current?.version !== msg.data.source.version) return
                    console.log(`'select' message received`, msg.data.start, msg.data.end)
                    const selectedObj = findSelectedGeomObject(geomObjectsRef.current, msg.data.start, msg.data.line)
                    setSelectedId(selectedObj?.id ?? null)
                } else {
                    console.warn(`Unknown message received: ${msg.data}`)
                }
            } catch (err) {
                console.error('Error while handling message from extension', err)
            }
        }
        window.addEventListener('message', onMessage)
        postMsgToVscode({ command: 'ready' })
        return () => window.removeEventListener('message', onMessage)
    }, [])

    // --- Handle selection (from list or map) ---
    const handleSelect = useCallback((obj: GeomObject) => {
        if (!source) return
        setSelectedId(obj.id)
        postMsgToVscode({
            command: 'select',
            start: obj.token.start,
            end: obj.token.end,
            source,
        })
    }, [source])

    const sendScopeRequest = useCallback((command: 'captureArea' | 'showDocument' | 'fitAll') => {
        if (source) postMsgToVscode({ command, source })
    }, [source])

    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            width: '100vw',
        }}>
            {/* --- Side List --- */}
            <div style={{
                width: 320,
                background: '#f9f9f9',
                borderRight: '1px solid #eee',
                overflow: 'auto',
                padding: 8,
            }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <button onClick={() => sendScopeRequest('showDocument')} aria-pressed={scope.kind === 'document'}>Hela dokumentet</button>
                    <button onClick={() => sendScopeRequest('captureArea')} disabled={!captureAvailable} aria-pressed={scope.kind === 'area'}>Aktuellt område</button>
                </div>
                {source && <div style={{ fontSize: 12, marginBottom: 8, color: '#555' }}>
                    {scope.kind === 'area' && areaLineRange
                        ? `${source.filename} · Rader ${areaLineRange.start}–${areaLineRange.end} · ${geomObjects.length} geometrier`
                        : `${source.filename} · ${geomObjects.length} geometrier`}
                </div>}
                <button onClick={() => sendScopeRequest('fitAll')} style={{ marginBottom: 8 }}>Visa alla i bild</button>
                {scope.kind === 'area' && geomObjects.length === 0 && <p>Inga WKT-geometrier i området</p>}
                <GeomObjectsList
                    geomObjects={geomObjects}
                    selectedId={selectedId}
                    onSelect={handleSelect}
                />
            </div>

            {/* --- Map Area --- */}
            <div style={{ flex: 1, position: 'relative' }}>
                <MapContainer
                    crs={LL.CRS.Simple}
                    style={{ height: '100%', width: '100%' }}
                    minZoom={MAP_MIN_ZOOM}
                    maxBounds={[[-Infinity, -Infinity], [Infinity, Infinity]]}
                >
                    <GeomObjectsMap
                        geomObjects={geomObjects}
                        selectedId={selectedId}
                        onSelect={handleSelect}
                        fitId={fitId}
                    />
                </MapContainer>
            </div>
        </div>
    )
}
