import * as LL from 'leaflet'
import * as RL from 'react-leaflet'
import { GeomObject } from './App'
import { calculateBoundingBox } from './geojson-util'

export function GeomObjectsMap({
    geomObjects,
    selectedId,
    onSelect
}: {
    geomObjects: GeomObject[]
    selectedId?: number | null
    onSelect?: (obj: GeomObject) => void
}) {
    const map = RL.useMap()
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
        <RL.GeoJSON
            key={geomObj.id}
            data={geomObj.feature}
            onEachFeature={handleFeatureClick(geomObj)}
            style={() => styleFn(geomObj)}
        />
    )
}


