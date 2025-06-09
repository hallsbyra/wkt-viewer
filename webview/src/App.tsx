import { Position } from 'geojson'
import * as LL from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { GeoJSON, MapContainer, useMap } from 'react-leaflet'
import wellknown from 'wellknown'

type GeomObject = {
    wkt: string
    feature: GeoJSON.Feature
}


export default function App() {
    const [geomObjects, setGeomObjects] = useState<GeomObject[]>([])

    let tsStart = new Date()

    useEffect(() => {
        // Message handler
        const onMessage = (event: MessageEvent) => {
            console.log('Received message from extension')
            tsStart = new Date()
            const msg = event.data
            if (msg.command === 'update') {
                try {
                    const wktArr = msg.wkt as string[]
                    const geomObjects = wktArr
                        .map(wktStr => {
                            const geojson = wellknown.parse(wktStr)
                            if (!geojson) throw new Error('Invalid WKT')
                            return {
                                wkt: wktStr,
                                feature: { type: 'Feature' as const, geometry: geojson, properties: {} }
                            }
                        })
                    console.log('Parsed', geomObjects.length, 'geometries after', new Date().getTime() - tsStart.getTime(), 'ms', geomObjects)
                    setGeomObjects(geomObjects)
                } catch (err) {
                    console.error(err)
                }
            }
        }
        console.log('Adding message listener')
        window.addEventListener('message', onMessage)
        return () => {
            console.log('Cleaning up message listener')
            window.removeEventListener('message', onMessage)
        }
    }, [])

    function testButtonClicked() {
        console.log('Test button clicked')
        // Generate a random geom object
        const randomFeature: GeoJSON.Feature = {
            type: 'Feature',
            geometry: {
                type: 'LineString' as const,
                coordinates: [[Math.random() * 360 - 180, Math.random() * 180 - 90], [Math.random() * 360 - 180, Math.random() * 180 - 90]]
            },
            properties: {}
        }
        const geomObject = {
            wkt: wellknown.stringify(randomFeature as wellknown.GeoJSONFeature),
            feature: randomFeature
        }

        setGeomObjects((prev) => [...prev, geomObject])
    }


    useEffect(() => {
        console.log('Render completed after', new Date().getTime() - tsStart.getTime(), 'ms')
    })


    console.log('Starting render after', new Date().getTime() - tsStart.getTime(), 'ms')
    return (
        <div style={{ height: '100vh', width: '100vw' }}>
            <MapContainer
                crs={LL.CRS.Simple}
                style={{ height: '100%', width: '100%' }}
                maxBounds={[[-Infinity, -Infinity], [Infinity, Infinity]]} // Set max bounds to prevent panning outside the world
            >
                <GeomObjectsMap geomObjects={geomObjects} />
            </MapContainer>
            <button onClick={testButtonClicked}>Test</button>
        </div>
    )
}

function GeomObjectsMap({ geomObjects }: { geomObjects: GeomObject[] }) {
    const map = useMap()

    const bounds = calculateBoundingBox(geomObjects.map(obj => obj.feature.geometry)) ?? [[-90, -180], [90, 180]] // Default to world bounds if no geometries
    console.log('Calculated bounds:', bounds)
    map.fitBounds(bounds)

    const handleFeatureClick = (geomObj: GeomObject) => (feature: GeoJSON.Feature, layer: LL.Layer) => {
        layer.on('click', function (_) {
            console.log('Feature clicked:', feature, 'wkt:', geomObj.wkt)
        })
    }

    const geoJsons = geomObjects.map(geomObj =>
        <GeoJSON key={geomObj.wkt} data={geomObj.feature} onEachFeature={handleFeatureClick(geomObj)} />
    )

    return geoJsons
}


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
    // Return [southWest, northEast]
    return [[minY, minX], [maxY, maxX]] as [[number, number], [number, number]]
}