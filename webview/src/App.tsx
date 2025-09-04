import { wktToGeoJSON } from '@terraformer/wkt'
import * as LL from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useState } from 'react'
import { MapContainer } from 'react-leaflet'
import { WebviewApi } from 'vscode-webview'
import { MsgFromWebview, MsgToWebview, WktToken } from '../../extension/src/public-types'
import { GeomObjectsList } from './GeomObjectsList'
import { GeomObjectsMap } from './GeomObjectsMap'
import { useLatest } from './react-util'

export type GeomObject = {
    id: number
    token: WktToken
    feature: GeoJSON.Feature
}

let vsCodeApi: WebviewApi<unknown> | null = null
const getVsCodeApi = () => (vsCodeApi ??= acquireVsCodeApi())

function postMsgToVscode(msg: MsgFromWebview) {
    console.log('Posting message to VSCode:', msg)
    getVsCodeApi().postMessage(msg)
}

export function wktTokensToGeomObjects(wktTokens: WktToken[]): GeomObject[] {
    return wktTokens.map(wktToken => {
        const geojson = wktToGeoJSON(wktToken.wkt)
        if (!geojson) throw new Error('Invalid WKT: ' + wktToken.wkt)
        return {
            id: wktToken.start,
            token: wktToken,
            feature: { type: 'Feature', geometry: geojson as GeoJSON.Geometry, properties: {} },
        }
    })
}

function findSelectedGeomObject(geomObjects: GeomObject[], start: number, line: number): GeomObject | null {
    const geomsOnSameLine = geomObjects.filter(obj => obj.token.line <= line && obj.token.endLine >= line)
    // Find the first geometry that contains the start position, or the first on the line.
    return geomsOnSameLine.find(obj => obj.token.start <= start && obj.token.end >= start) ?? geomsOnSameLine[0] ?? null
}


export default function App() {
    const [geomObjects, setGeomObjects] = useState<GeomObject[]>([])
    const geomObjectsRef = useLatest(geomObjects)
    const [selectedId, setSelectedId] = useState<number | null>(null)

    // --- VSCode Message Listener ---
    useEffect(() => {
        function onMessage(msg: MessageEvent<MsgToWebview>) {
            try {
                if (msg.data.command === 'update') {
                    console.log(`'update' message received`, msg.data.wkt)
                    setGeomObjects(wktTokensToGeomObjects(msg.data.wkt))
                } else if (msg.data.command === 'select') {
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
        return () => window.removeEventListener('message', onMessage)
    }, [])

    // --- Handle selection (from list or map) ---
    const handleSelect = useCallback((obj: GeomObject) => {
        setSelectedId(obj.id)
        postMsgToVscode({
            command: 'select',
            start: obj.token.start,
            end: obj.token.end,
        })
    }, [])

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
                    maxBounds={[[-Infinity, -Infinity], [Infinity, Infinity]]}
                >
                    <GeomObjectsMap
                        geomObjects={geomObjects}
                        selectedId={selectedId}
                        onSelect={handleSelect}
                    />
                </MapContainer>
            </div>
        </div>
    )
}
