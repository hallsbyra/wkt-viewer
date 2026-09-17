import * as LL from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as RL from 'react-leaflet'
import { type GeomObject } from './App'
import { getAnnotationEntries, getTagColor } from './annotation'
import { getDirectionMarkers } from './DirectionMarker'
import { calculateBoundingBox } from './geojson-util'
import { DEFAULT_PATH_STYLE, POINT_RADIUS, POINT_RADIUS_SELECTED, SELECTED_PATH_STYLE } from './styles'

export function GeomObjectsMap({
    geomObjects,
    selectedId,
    onSelect,
    fitId,
    listFocusId,
    listFitId,
}: {
    geomObjects: GeomObject[]
    selectedId?: number | null
    onSelect?: (obj: GeomObject) => void
    fitId: number
    listFocusId: number
    listFitId: number
}) {
    const map = RL.useMap()
    const bounds = useMemo(
        () => calculateBoundingBox(geomObjects.map(obj => obj.feature.geometry)),
        [geomObjects],
    )
    const latestObjects = useRef(geomObjects)
    const latestOnSelect = useRef(onSelect)
    const lastFitId = useRef<number | null>(null)
    const lastListFocusId = useRef(0)
    const lastListFitId = useRef(0)
    const hasFittedCurrentScope = useRef(false)
    latestObjects.current = geomObjects
    latestOnSelect.current = onSelect

    // A new document/scope starts a fresh fitting cycle. If it starts empty,
    // fit once when its first valid geometry arrives; later edits keep the view.
    useEffect(() => {
        if (lastFitId.current !== fitId) {
            lastFitId.current = fitId
            hasFittedCurrentScope.current = false
        }
        if (!bounds || hasFittedCurrentScope.current) return

        map.fitBounds(bounds, { padding: [10, 10] })
        hasFittedCurrentScope.current = true
    }, [bounds, fitId, map])

    useEffect(() => {
        if (listFocusId === lastListFocusId.current) return
        lastListFocusId.current = listFocusId

        const selectedGeometry = geomObjects.find(object => object.id === selectedId)?.feature.geometry
        if (selectedGeometry) focusGeometryIfOutsideView(map, selectedGeometry)
    }, [geomObjects, listFocusId, map, selectedId])

    useEffect(() => {
        if (listFitId === lastListFitId.current) return
        lastListFitId.current = listFitId

        const selectedGeometry = geomObjects.find(object => object.id === selectedId)?.feature.geometry
        if (selectedGeometry) fitGeometry(map, selectedGeometry)
    }, [geomObjects, listFitId, map, selectedId])

    // Create marker for POINT geometries.
    function createPointMarker(geomObj: GeomObject, latlng: LL.LatLng) {
        return LL.circleMarker(latlng, getGeometryStyle(geomObj, selectedId))
    }

    const handleFeatureClick = (geomObj: GeomObject) => (_feature: GeoJSON.Feature, layer: LL.Layer) => {
        layer.on('click', () => {
            const currentObject = latestObjects.current.find(object => object.id === geomObj.id)
            if (currentObject) latestOnSelect.current?.(currentObject)
        })
        bindMetadataTooltip(geomObj, layer)
    }

    const selectedGeometry = useMemo(() => {
        if (selectedId == null) return null
        return geomObjects.find(geom => geom.id === selectedId)?.feature.geometry ?? null
    }, [selectedId, geomObjects])

    useMiddleButtonPanning(map)

    return (
        <>
            {geomObjects.map(geomObj => (
                <RL.GeoJSON
                    key={`${geomObj.id}:${geomObj.token.end}:${geomObj.token.wkt}`}
                    data={geomObj.feature}
                    onEachFeature={handleFeatureClick(geomObj)}
                    style={() => getGeometryStyle(geomObj, selectedId)}
                    pointToLayer={(_feature, latlng) => createPointMarker(geomObj, latlng)}
                />
            ))}
            {selectedGeometry && <VisibleDirectionMarkers geometry={selectedGeometry} />}
        </>
    )
}

/**
 * The selected style deliberately takes precedence over a tag color so the
 * current geometry remains identifiable on dense maps.
 *
 * CircleMarker also reads radius from setStyle, which lets selection resize
 * POINT geometries after they have been created.
 */
export function getGeometryStyle(geomObj: GeomObject, selectedId?: number | null): LL.CircleMarkerOptions {
    if (geomObj.id === selectedId) {
        return { ...SELECTED_PATH_STYLE, radius: POINT_RADIUS_SELECTED }
    }

    const tagColor = getTagColor(geomObj.token.annotation?.tag)
    return {
        ...DEFAULT_PATH_STYLE,
        radius: POINT_RADIUS,
        ...(tagColor && { color: tagColor, fillColor: tagColor }),
    }
}

/** Move to a geometry chosen in the list only when it is off screen. */
export function focusGeometryIfOutsideView(map: LL.Map, geometry: GeoJSON.Geometry) {
    const targetBounds = geometryBounds(geometry)
    if (!targetBounds) return
    if (map.getBounds().intersects(targetBounds)) return

    fitGeometryBounds(map, targetBounds)
}

/** Adapt the map to show a geometry in its entirety. */
export function fitGeometry(map: LL.Map, geometry: GeoJSON.Geometry) {
    const targetBounds = geometryBounds(geometry)
    if (targetBounds) fitGeometryBounds(map, targetBounds)
}

function geometryBounds(geometry: GeoJSON.Geometry) {
    const coordinates = calculateBoundingBox([geometry])
    return coordinates && LL.latLngBounds(coordinates)
}

function fitGeometryBounds(map: LL.Map, targetBounds: LL.LatLngBounds) {
    if (targetBounds.getNorthWest().equals(targetBounds.getSouthEast())) {
        map.panTo(targetBounds.getCenter())
        return
    }
    map.fitBounds(targetBounds, { padding: [10, 10] })
}

function VisibleDirectionMarkers({ geometry }: { geometry: GeoJSON.Geometry }) {
    const map = RL.useMap()
    const [viewKey, setViewKey] = useState(() => getMapViewKey(map))
    const latestViewKey = useRef(viewKey)

    useEffect(() => {
        const updateView = () => {
            const nextViewKey = getMapViewKey(map)
            if (nextViewKey === latestViewKey.current) return

            latestViewKey.current = nextViewKey
            setViewKey(nextViewKey)
        }

        map.on('moveend zoomend resize', updateView)
        return () => {
            map.off('moveend zoomend resize', updateView)
        }
    }, [map])

    const markers = useMemo(
        () => getDirectionMarkers(geometry, map.getBounds()),
        [geometry, map, viewKey],
    )

    return <>{markers}</>
}

function getMapViewKey(map: LL.Map) {
    return `${map.getZoom()}:${map.getBounds().toBBoxString()}`
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
