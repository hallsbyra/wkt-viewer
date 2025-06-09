import { Position } from 'geojson'
import * as LL from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { GeoJSON, MapContainer, useMap } from 'react-leaflet'
import wellknown from 'wellknown'
import { GeomObjectsList } from './GeomObjectsList'
import { WktToken } from '../../extension/src/wkt'

export type GeomObject = {
    id: number
    token: WktToken
    feature: GeoJSON.Feature
}

const vscode = acquireVsCodeApi()

export default function App() {
    const [geomObjects, setGeomObjects] = useState<GeomObject[]>([])
    const geomObjectsRef = useLatest(geomObjects)
    const [selectedId, setSelectedId] = useState<number | null>(null)

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            const msg = event.data
            if (msg.command === 'update') {
                try {
                    const wktArr = msg.wkt as WktToken[]
                    const newObjects = wktArr
                        .map(wktToken => {
                            const geojson = wellknown.parse(wktToken.wkt)
                            if (!geojson) throw new Error('Invalid WKT')
                            return {
                                id: wktToken.start, // Use start as a unique ID
                                token: wktToken,
                                feature: { type: 'Feature' as const, geometry: geojson, properties: {} },
                                locked: false,
                            }
                        })
                    setGeomObjects(newObjects)
                } catch (err) {
                    console.error(err)
                }
            }
            else if (msg.command === 'select') {
                const start = msg.start as number
                const selected = geomObjectsRef.current.find(obj => obj.token.start <= start && obj.token.end >= start)
                if (selected) {
                    setSelectedId(selected.id)
                } else {
                    setSelectedId(null)
                }
            }
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
    }, [])

    function testButtonClicked() {
        const randomFeature: GeoJSON.Feature = {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[Math.random() * 360 - 180, Math.random() * 180 - 90], [Math.random() * 360 - 180, Math.random() * 180 - 90]]
            },
            properties: {}
        }
        const geomObject: GeomObject = {
            id: 0,
            token: { start: 0, end: 0, wkt: wellknown.stringify(randomFeature as wellknown.GeoJSONFeature) },
            feature: randomFeature,
        }
        setGeomObjects(prev => [...prev, geomObject])
    }

    // For map click selection
    function handleSelect(obj: GeomObject) {
        setSelectedId(obj.id)
        vscode.postMessage({
            command: 'select',
            start: obj.token.start,
            end: obj.token.end
        })
    }

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
            <div style={{ width: 320, background: '#f9f9f9', borderRight: '1px solid #eee', overflow: 'auto', padding: 8 }}>
                <GeomObjectsList
                    geomObjects={geomObjects}
                    selectedId={selectedId}
                    onSelect={handleSelect}
                />
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
                <MapContainer
                    crs={LL.CRS.Simple}
                    style={{ height: '100%', width: '100%' }}
                    maxBounds={[[-Infinity, -Infinity], [Infinity, Infinity]]}
                >
                    <GeomObjectsMap geomObjects={geomObjects} selectedId={selectedId} onSelect={handleSelect} />
                </MapContainer>
                <button onClick={testButtonClicked} style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000 }}>
                    Test
                </button>
            </div>
        </div>
    )
}

function GeomObjectsMap({
    geomObjects,
    selectedId,
    onSelect
}: {
    geomObjects: GeomObject[]
    selectedId?: number | null
    onSelect?: (obj: GeomObject) => void
}) {
    const map = useMap()
    const bounds = calculateBoundingBox(geomObjects.map(obj => obj.feature.geometry)) ?? [[-90, -180], [90, 180]]
    map.fitBounds(bounds)

    // Provide a different style for selected
    function styleFn(geomObj: GeomObject) {
        if (geomObj.id === selectedId) {
            return {
                color: '#0288d1',
                weight: 6,
                opacity: 1,
                fillColor: '#b3e5fc',
                fillOpacity: 0.5,
            }
        }
        return {
            color: '#888',
            weight: 3,
            opacity: 0.7,
            fillColor: '#ccc',
            fillOpacity: 0.2,
        }
    }

    const handleFeatureClick = (geomObj: GeomObject) => (_feature: GeoJSON.Feature, layer: LL.Layer) => {
        layer.on('click', function (_) {
            if (onSelect) onSelect(geomObj)
        })
    }

    return geomObjects.map(geomObj =>
        <GeoJSON
            key={geomObj.token.wkt}
            data={geomObj.feature}
            onEachFeature={handleFeatureClick(geomObj)}
            style={() => styleFn(geomObj)}
        />
    )
}

// ...getCoords, calculateBoundingBox same as before...
function getCoords(geometry: GeoJSON.Geometry): Position[] {
    if (geometry.type === 'Point')
        return [geometry.coordinates]
    if (geometry.type === 'LineString' || geometry.type === 'MultiPoint')
        return geometry.coordinates
    if (geometry.type === 'Polygon' || geometry.type === 'MultiLineString')
        return geometry.coordinates.flat()
    if (geometry.type === 'MultiPolygon')
        return geometry.coordinates.flat(2)
    if (geometry.type === 'GeometryCollection')
        return geometry.geometries.flatMap(getCoords)
    return []
}

function calculateBoundingBox(geometries: GeoJSON.Geometry[]) {
    if (geometries.length === 0)
        return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const geom of geometries) {
        const coords = getCoords(geom)
        for (const [x, y] of coords) {
            if (x < minX) minX = x
            if (y < minY) minY = y
            if (x > maxX) maxX = x
            if (y > maxY) maxY = y
        }
    }
    return [[minY, minX], [maxY, maxX]] as [[number, number], [number, number]]
}


/**
 * Keeps a mutable ref containing the latest value. Whenever the `value` changes
 * we update the `.current` field. Inside callbacks you can always read
 * `latest.current` and be sure it is up‑to‑date.
 */
function useLatest<T>(value: T) {
    const latestRef = useRef(value)
    useEffect(() => {
        latestRef.current = value
    }, [value])
    return latestRef
}