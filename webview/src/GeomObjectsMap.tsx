import * as LL from 'leaflet'
import * as RL from 'react-leaflet'
import { GeomObject } from './App'
import { calculateBoundingBox } from './geojson-util'
import { useEffect } from 'react'

// ---- Style & Color Constants ----
const COLOR = {
    selectedStroke: '#0288d1',
    selectedFill: '#b3e5fc',
    defaultStroke: '#555',
    defaultFill: '#ccc',
}

const SELECTED_PATH_STYLE: LL.PathOptions = {
    color: COLOR.selectedStroke,
    weight: 4,
    opacity: 1,
    fillColor: COLOR.selectedFill,
    fillOpacity: 0.6,
}

const DEFAULT_PATH_STYLE: LL.PathOptions = {
    color: COLOR.defaultStroke,
    weight: 2,
    opacity: 0.8,
    fillColor: COLOR.defaultFill,
    fillOpacity: 0.25,
}

const POINT_RADIUS = 6
const POINT_RADIUS_SELECTED = 7
// ---- End constants ----

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

    // Fit bounds when collection changes
    useEffect(() => {
        if (geomObjects.length === 0) return
        const bounds = calculateBoundingBox(geomObjects.map(obj => obj.feature.geometry))
        if (bounds) map.fitBounds(bounds, { padding: [10, 10] })
    }, [geomObjects, map])

    // Style function
    function styleFn(geomObj: GeomObject): LL.PathOptions {
        return geomObj.id === selectedId ? SELECTED_PATH_STYLE : DEFAULT_PATH_STYLE
    }

    // Create marker for POINT geometries
    function createPointMarker(geomObj: GeomObject, latlng: LL.LatLng) {
        return LL.circleMarker(latlng, {
            radius: geomObj.id === selectedId ? POINT_RADIUS_SELECTED : POINT_RADIUS,
        })
    }

    const handleFeatureClick = (geomObj: GeomObject) => (_feature: GeoJSON.Feature, layer: LL.Layer) => {
        layer.on('click', () => onSelect?.(geomObj))
    }

    return (
        <>
            {geomObjects.map(geomObj => (
                <RL.GeoJSON
                    key={geomObj.id}
                    data={geomObj.feature}
                    onEachFeature={handleFeatureClick(geomObj)}
                    style={() => styleFn(geomObj)}
                    pointToLayer={(_feature, latlng) => createPointMarker(geomObj, latlng)}
                />
            ))}
        </>
    )
}


