import * as LL from 'leaflet'
import { useEffect, useMemo } from 'react'
import * as RL from 'react-leaflet'
import { GeomObject } from './App'
import { getDirectionMarkers } from './DirectionMarker'
import { calculateBoundingBox } from './geojson-util'
import { DEFAULT_PATH_STYLE, POINT_RADIUS, POINT_RADIUS_SELECTED, SELECTED_PATH_STYLE } from './styles'


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
    // Compute overall bounds and a stable key so we can detect real changes.
    const { bounds, boundsKey } = useMemo(() => {
        const bounds = calculateBoundingBox(geomObjects.map(obj => obj.feature.geometry)) ?? [[0,0], [1,1]]
        const boundsKey = `${bounds[0][0]},${bounds[0][1]},${bounds[1][0]},${bounds[1][1]}`
        return { bounds, boundsKey }
    }, [geomObjects])

    // Fit bounds when the overall bounds change (initial load or content update)
    useEffect(() => {
        map.fitBounds(bounds, { padding: [10, 10] })
    }, [boundsKey, map])

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

    const directionMarkers = useMemo(() => {
        if (selectedId == null) return []
        const sel = geomObjects.find(g => g.id === selectedId)
        if (!sel) return []
        return getDirectionMarkers(sel.feature.geometry)
    }, [selectedId, geomObjects])

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
            {directionMarkers}
        </>
    )
}
