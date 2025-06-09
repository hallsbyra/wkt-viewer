import { Position } from 'geojson'
import * as LL from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { GeoJSON, MapContainer, useMap } from 'react-leaflet'
import wellknown from 'wellknown'

type GeomObject = {
    wkt: string
    feature: GeoJSON.Feature
    locked?: boolean
}

export default function App() {
    const [geomObjects, setGeomObjects] = useState<GeomObject[]>([])

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            const msg = event.data
            if (msg.command === 'update') {
                try {
                    const wktArr = msg.wkt as string[]
                    setGeomObjects(prevGeomObjects => {
                        // 1. Keep all locked objects
                        const locked = prevGeomObjects.filter(obj => obj.locked)
                        // 2. Make a Set for fast lookup
                        const lockedWkts = new Set(locked.map(obj => obj.wkt))
                        // 3. Parse new objects, skipping locked ones (add those below)
                        const newObjects = wktArr
                            .filter(wktStr => !lockedWkts.has(wktStr))
                            .map(wktStr => {
                                const geojson = wellknown.parse(wktStr)
                                if (!geojson) throw new Error('Invalid WKT')
                                return {
                                    wkt: wktStr,
                                    feature: { type: 'Feature' as const, geometry: geojson, properties: {} },
                                    locked: false,
                                }
                            })
                        // 4. Combine locked + new, de-dup by wkt
                        const combined = [...locked, ...newObjects]
                        // Remove accidental duplicates
                        return Array.from(new Map(combined.map(obj => [obj.wkt, obj])).values())
                    })
                } catch (err) {
                    console.error(err)
                }
            }
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
    }, [])

    function testButtonClicked() {
        // Generate a random geom object
        const randomFeature: GeoJSON.Feature = {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[Math.random() * 360 - 180, Math.random() * 180 - 90], [Math.random() * 360 - 180, Math.random() * 180 - 90]]
            },
            properties: {}
        }
        const geomObject: GeomObject = {
            wkt: wellknown.stringify(randomFeature as wellknown.GeoJSONFeature),
            feature: randomFeature,
            locked: false,
        }
        setGeomObjects(prev => [...prev, geomObject])
    }

    function setLocked(wkt: string, locked: boolean) {
        setGeomObjects(prev =>
            prev.map(obj => obj.wkt === wkt ? { ...obj, locked } : obj)
        )
    }

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
            <div style={{ width: 320, background: '#f9f9f9', borderRight: '1px solid #eee', overflow: 'auto', padding: 8 }}>
                <GeomObjectsList geomObjects={geomObjects} setLocked={setLocked} />
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
                <MapContainer
                    crs={LL.CRS.Simple}
                    style={{ height: '100%', width: '100%' }}
                    maxBounds={[[-Infinity, -Infinity], [Infinity, Infinity]]}
                >
                    <GeomObjectsMap geomObjects={geomObjects} />
                </MapContainer>
                <button onClick={testButtonClicked} style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000 }}>
                    Test
                </button>
            </div>
        </div>
    )
}

function GeomObjectsList({
    geomObjects,
    setLocked,
}: {
    geomObjects: GeomObject[]
    setLocked: (wkt: string, locked: boolean) => void
}) {
    return (
        <div>
            <h3 style={{ margin: '4px 0 8px 0' }}>Geometries ({geomObjects.length})</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {geomObjects.map((obj, idx) => (
                    <li key={obj.wkt} style={{
                        marginBottom: 8,
                        padding: 8,
                        borderRadius: 8,
                        background: obj.locked ? '#ffe' : '#fff',
                        boxShadow: '0 1px 3px #0001',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500 }}>#{idx + 1}</div>
                            <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#2e7d32' }}>{obj.feature.geometry.type}</div>
                            <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', color: '#666' }}>{obj.wkt}</div>
                        </div>
                        <button
                            style={{
                                fontSize: 13,
                                padding: '2px 8px',
                                background: obj.locked ? '#ffd600' : '#eee',
                                border: 'none',
                                borderRadius: 5,
                                cursor: 'pointer'
                            }}
                            onClick={() => setLocked(obj.wkt, !obj.locked)}
                            title={obj.locked ? 'Unlock' : 'Lock'}
                        >
                            {obj.locked ? '🔒' : '🔓'}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}

function GeomObjectsMap({ geomObjects }: { geomObjects: GeomObject[] }) {
    const map = useMap()
    const bounds = calculateBoundingBox(geomObjects.map(obj => obj.feature.geometry)) ?? [[-90, -180], [90, 180]]
    map.fitBounds(bounds)
    const handleFeatureClick = (geomObj: GeomObject) => (feature: GeoJSON.Feature, layer: LL.Layer) => {
        layer.on('click', function (_) {
            console.log('Feature clicked:', feature, 'wkt:', geomObj.wkt)
        })
    }
    return geomObjects.map(geomObj =>
        <GeoJSON key={geomObj.wkt} data={geomObj.feature} onEachFeature={handleFeatureClick(geomObj)} />
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
