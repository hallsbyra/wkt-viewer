import { Position } from 'geojson'
import * as LL from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { GeoJSON, MapContainer, useMap } from 'react-leaflet'
import wellknown from 'wellknown'
import { GeomObjectsList } from './GeomObjectsList'

type GeomObject = {
    wkt: string
    feature: GeoJSON.Feature
    locked?: boolean
}

export default function App() {
    const [geomObjects, setGeomObjects] = useState<GeomObject[]>([])
    const [selectedWkt, setSelectedWkt] = useState<string | null>(null)

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            const msg = event.data
            if (msg.command === 'update') {
                try {
                    const wktArr = msg.wkt as string[]
                    setGeomObjects(prevGeomObjects => {
                        const locked = prevGeomObjects.filter(obj => obj.locked)
                        const lockedWkts = new Set(locked.map(obj => obj.wkt))
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
                        const combined = [...locked, ...newObjects]
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

    // For map click selection
    function handleSelect(wkt: string) {
        setSelectedWkt(wkt)
    }

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
            <div style={{ width: 320, background: '#f9f9f9', borderRight: '1px solid #eee', overflow: 'auto', padding: 8 }}>
                <GeomObjectsList
                    geomObjects={geomObjects}
                    setLocked={setLocked}
                    selectedWkt={selectedWkt}
                    onSelect={handleSelect}
                />
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
                <MapContainer
                    crs={LL.CRS.Simple}
                    style={{ height: '100%', width: '100%' }}
                    maxBounds={[[-Infinity, -Infinity], [Infinity, Infinity]]}
                >
                    <GeomObjectsMap geomObjects={geomObjects} selectedWkt={selectedWkt} onSelect={handleSelect} />
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
    selectedWkt,
    onSelect
}: {
    geomObjects: GeomObject[]
    selectedWkt?: string | null
    onSelect?: (wkt: string) => void
}) {
    const map = useMap()
    const bounds = calculateBoundingBox(geomObjects.map(obj => obj.feature.geometry)) ?? [[-90, -180], [90, 180]]
    map.fitBounds(bounds)

    // Provide a different style for selected
    function styleFn(geomObj: GeomObject) {
        if (geomObj.wkt === selectedWkt) {
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

    const handleFeatureClick = (geomObj: GeomObject) => (feature: GeoJSON.Feature, layer: LL.Layer) => {
        layer.on('click', function (_) {
            if (onSelect) onSelect(geomObj.wkt)
        })
    }

    return geomObjects.map(geomObj =>
        <GeoJSON
            key={geomObj.wkt}
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
