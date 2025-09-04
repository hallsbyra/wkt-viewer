import * as LL from 'leaflet'
import * as RL from 'react-leaflet'
import { COLOR } from './styles'

const ARROW_SIZE_PX = 14
const ARROW_COLOR = COLOR.selectedStroke

/**
 * Component for a direction marker (arrow) at a given latlng and angle.
 */
export function DirectionMarker({ latlng, angleDeg }: { latlng: [number, number], angleDeg: number }) {
    // Base triangle points right (→). Adjust rotation directly via CSS.
    const cssAngle = -angleDeg // clockwise for screen coords
    // Chevron made of two lines meeting at the point (no fill)
    const html = `<svg width="${ARROW_SIZE_PX}" height="${ARROW_SIZE_PX}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style="transform:rotate(${cssAngle}deg);transform-origin:50% 50%;"><path d="M2 2 L18 10 M2 18 L18 10" stroke="${ARROW_COLOR}" stroke-width="2.2" stroke-linecap="round" fill="none" /></svg>`
    const icon = LL.divIcon({ html, className: 'wkt-arrow', iconSize: [ARROW_SIZE_PX, ARROW_SIZE_PX], iconAnchor: [ARROW_SIZE_PX / 2, ARROW_SIZE_PX / 2] })
    return <RL.Marker position={latlng} icon={icon} />
}

type Pos = [number, number]
type DirectionMarkerInfo = { pos: Pos, angleDeg: number }

/**
 * Calculate positions and angles for direction markers along a geometry.
 */
export function getDirectionMarkerInfo(geom: GeoJSON.Geometry): DirectionMarkerInfo[] {
    if (!['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(geom.type)) return []

    const result: DirectionMarkerInfo[] = []
    const addSegmentArrow = (a: GeoJSON.Position, b: GeoJSON.Position) => {
        const dx = b[0] - a[0]
        const dy = b[1] - a[1]
        const len = Math.hypot(dx, dy)
        if (len === 0) return
        const midX = (a[0] + b[0]) / 2
        const midY = (a[1] + b[1]) / 2
        const angleRad = Math.atan2(dy, dx)
        const angleDeg = angleRad * 180 / Math.PI
        result.push({ pos: [midX, midY], angleDeg })
    }
    const addForLine = (coords: GeoJSON.Position[]) => {
        for (let i = 0; i < coords.length - 1; i++) {
            addSegmentArrow(coords[i], coords[i + 1])
        }
    }
    if (geom.type === 'LineString') {
        addForLine((geom as GeoJSON.LineString).coordinates)
    } else if (geom.type === 'MultiLineString') {
        for (const ls of (geom as GeoJSON.MultiLineString).coordinates) addForLine(ls)
    } else if (geom.type === 'Polygon') {
        for (const ring of (geom as GeoJSON.Polygon).coordinates) addForLine(ring)
    } else if (geom.type === 'MultiPolygon') {
        for (const poly of (geom as GeoJSON.MultiPolygon).coordinates)
            for (const ring of poly) addForLine(ring)
    }
    return result
}

/**
 * Helper for creating direction markers for a geometry.
 */
export function getDirectionMarkers(geom: GeoJSON.Geometry) {
    const markers = getDirectionMarkerInfo(geom)
    return markers.map((a, i) => (<DirectionMarker key={i} latlng={[a.pos[1], a.pos[0]]} angleDeg={a.angleDeg} />))
}

