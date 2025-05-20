import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, Rectangle } from 'react-leaflet'
import { CRS, Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import wellknown from 'wellknown'

// Add a module declaration for wellknown if needed
// declare module 'wellknown';

export default function App() {
    const [geojsons, setGeojsons] = useState<GeoJSON.Feature[]>([])
    const mapRef = useRef<LeafletMap | null>(null)

    useEffect(() => {
        // Message handler
        const onMessage = (event: MessageEvent) => {
            console.log('Received message from extension:', event.data)
            const msg = event.data
            if (msg.command === 'update') {
                try {
                    const wktArr = msg.wkt as string[]
                    const features = wktArr
                        .map((wktStr, i) => {
                            try {
                                const geojson = wellknown.parse(wktStr)
                                if (!geojson) throw new Error('Invalid WKT')
                                // Wrap as Feature if not already
                                // if (geojson.type === 'Feature') return geojson
                                return { type: 'Feature', geometry: geojson, properties: {} } as GeoJSON.Feature
                            } catch {
                                console.warn(`Invalid WKT at ${i}:`, wktStr)
                                return null
                            }
                        })
                        .filter((f): f is GeoJSON.Feature => f != null)
                    if (features.length === 0) {
                        throw new Error('No valid geometries')
                    }
                    setGeojsons(features)
                    console.log('Parsed features:', features)
                    // Fit bounds if possible
                    if (mapRef.current && features.length > 0) {
                        const leafletMap = mapRef.current
                        // Compute bounds from all features
                        const allCoords: [number, number][] = features.flatMap(f => {
                            const geom = f.geometry
                            if (geom.type === 'Point') return [geom.coordinates as [number, number]]
                            if (geom.type === 'LineString' || geom.type === 'MultiPoint') return geom.coordinates as [number, number][]
                            if (geom.type === 'Polygon' || geom.type === 'MultiLineString') return (geom.coordinates as [number, number][][]).flat()
                            if (geom.type === 'MultiPolygon') return (geom.coordinates as [number, number][][][]).flat(2)
                            return []
                        })
                        if (allCoords.length > 0) {
                            const lats = allCoords.map(c => c[1])
                            const lngs = allCoords.map(c => c[0])
                            const southWest: [number, number] = [Math.min(...lats), Math.min(...lngs)]
                            const northEast: [number, number] = [Math.max(...lats), Math.max(...lngs)]
                            // Swap to [lat, lng] order for Leaflet
                            console.log('Bounds:', southWest, northEast)
                            leafletMap.fitBounds([
                                [southWest[0], southWest[1]],
                                [northEast[0], northEast[1]]
                            ], { padding: [10, 10], maxZoom: 1500 })

                            // leafletMap.fitBounds([
                            //     [0, 0],
                            //     [100, 100]
                            // ], { padding: [10, 10], maxZoom: 1500})

                        }
                    }
                } catch (err) {
                    console.error(err)
                }
            }
        }
        window.addEventListener('message', onMessage)
        return () => {
            window.removeEventListener('message', onMessage)
        }
    }, [])

    function handleFeatureClick(feature, layer) {
        layer.on('click', function (e) {
            console.log('Feature clicked:', feature);
            // You can call setState, open a popup, etc.
        });
    }

    return (
        <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
            <MapContainer
                center={[0, 0]}
                crs={CRS.Simple}
                zoom={2}
                style={{ height: '100%', width: '100%' }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                maxBounds={[[-Infinity, -Infinity], [Infinity, Infinity]]} // Set max bounds to prevent panning outside the world
                whenReady={(args: any) => { mapRef.current = args.target as LeafletMap }}
            >
                {/* <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                /> */}
                {geojsons.map((geojson, i) => (
                    <GeoJSON key={i} data={geojson} onEachFeature={handleFeatureClick} />
                ))}
            </MapContainer>
        </div>
    )
}

