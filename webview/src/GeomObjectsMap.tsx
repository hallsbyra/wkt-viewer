import * as LL from 'leaflet'
import { useEffect, useMemo, useRef } from 'react'
import * as RL from 'react-leaflet'
import { GeomObject } from './App'
import { getAnnotationEntries, getTagColor } from './annotation'
import { getDirectionMarkers } from './DirectionMarker'
import { calculateBoundingBox } from './geojson-util'
import { DEFAULT_PATH_STYLE, POINT_RADIUS, POINT_RADIUS_SELECTED, SELECTED_PATH_STYLE } from './styles'

export function GeomObjectsMap({
    geomObjects,
    selectedId,
    onSelect,
    fitId,
}: {
    geomObjects: GeomObject[]
    selectedId?: number | null
    onSelect?: (obj: GeomObject) => void
    fitId: number
}) {
    const map = RL.useMap()
    const bounds = useMemo(
        () => calculateBoundingBox(geomObjects.map(obj => obj.feature.geometry)),
        [geomObjects],
    )
    const latestObjects = useRef(geomObjects)
    const latestOnSelect = useRef(onSelect)
    latestObjects.current = geomObjects
    latestOnSelect.current = onSelect

    // Scope changes and the explicit control provide fitId. Coordinates alone do not.
    useEffect(() => {
        if (!bounds) return
        map.fitBounds(bounds, { padding: [10, 10] })
    }, [fitId, map])

    // Style function
    function styleFn(geomObj: GeomObject): LL.PathOptions {
        const tagColor = getTagColor(geomObj.token.annotation?.tag)
        if (!tagColor) {
            return geomObj.id === selectedId ? SELECTED_PATH_STYLE : DEFAULT_PATH_STYLE
        }

        return {
            ...DEFAULT_PATH_STYLE,
            color: tagColor,
            fillColor: tagColor,
            weight: geomObj.id === selectedId ? 4 : DEFAULT_PATH_STYLE.weight,
            opacity: geomObj.id === selectedId ? 1 : DEFAULT_PATH_STYLE.opacity,
            fillOpacity: geomObj.id === selectedId ? 0.45 : DEFAULT_PATH_STYLE.fillOpacity,
        }
    }

    // Create marker for POINT geometries
    function createPointMarker(geomObj: GeomObject, latlng: LL.LatLng) {
        const pathStyle = styleFn(geomObj)
        return LL.circleMarker(latlng, {
            radius: geomObj.id === selectedId ? POINT_RADIUS_SELECTED : POINT_RADIUS,
            ...pathStyle,
        })
    }

    const handleFeatureClick = (geomObj: GeomObject) => (_feature: GeoJSON.Feature, layer: LL.Layer) => {
        layer.on('click', () => {
            const currentObject = latestObjects.current.find(object => object.id === geomObj.id)
            if (currentObject) latestOnSelect.current?.(currentObject)
        })
        bindMetadataTooltip(geomObj, layer)
    }

    const directionMarkers = useMemo(() => {
        if (selectedId == null) return []
        const sel = geomObjects.find(g => g.id === selectedId)
        if (!sel) return []
        return getDirectionMarkers(sel.feature.geometry)
    }, [selectedId, geomObjects])

    useMiddleButtonPanning(map)

    return (
        <>
            {geomObjects.map(geomObj => (
                <RL.GeoJSON
                    key={`${geomObj.id}:${geomObj.token.end}:${geomObj.token.wkt}`}
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

function bindMetadataTooltip(geomObj: GeomObject, layer: LL.Layer) {
    const annotation = geomObj.token.annotation
    if (!annotation) return

    const tooltipLayer = layer as LL.Layer & {
        bindTooltip?: (content: HTMLElement, options?: LL.TooltipOptions) => LL.Layer
    }
    tooltipLayer.bindTooltip?.(createMetadataTooltip(annotation), {
        sticky: true,
        direction: 'top',
    })
}

function createMetadataTooltip(annotation: NonNullable<GeomObject['token']['annotation']>): HTMLElement {
    const container = document.createElement('div')
    container.style.display = 'grid'
    container.style.gridTemplateColumns = 'auto 1fr'
    container.style.gap = '2px 8px'

    for (const [key, value] of getAnnotationEntries(annotation)) {
        const keyElement = document.createElement('span')
        keyElement.textContent = key
        keyElement.style.fontWeight = '600'

        const valueElement = document.createElement('span')
        valueElement.textContent = value
        valueElement.style.fontFamily = 'monospace'

        container.append(keyElement, valueElement)
    }

    return container
}

// Allow middle-button drag panning without changing Leaflet's default drag behavior.
function useMiddleButtonPanning(map: LL.Map) {
    useEffect(() => {
        const container = map.getContainer()
        if (!container) return

        let isMiddlePanning = false
        let lastPosition: { x: number, y: number } | null = null

        const stopPanning = () => {
            if (!isMiddlePanning) return
            isMiddlePanning = false
            lastPosition = null
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', stopPanning)
        }

        const handleMouseMove = (event: MouseEvent) => {
            if (!isMiddlePanning || !lastPosition) return
            // If the middle button is released while moving, stop panning.
            if ((event.buttons ?? 0) && (event.buttons & 4) === 0) {
                stopPanning()
                return
            }

            const dx = event.clientX - lastPosition.x
            const dy = event.clientY - lastPosition.y
            lastPosition = { x: event.clientX, y: event.clientY }
            map.panBy([-dx, -dy], { animate: false })
        }

        const handleMouseDown = (event: MouseEvent) => {
            if (event.button !== 1) return
            event.preventDefault()
            isMiddlePanning = true
            lastPosition = { x: event.clientX, y: event.clientY }
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', stopPanning)
        }

        container.addEventListener('mousedown', handleMouseDown)

        return () => {
            container.removeEventListener('mousedown', handleMouseDown)
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', stopPanning)
        }
    }, [map])
}
