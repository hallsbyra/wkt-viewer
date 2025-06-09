/**
 * Extracts all coordinates from a GeoJSON Geometry as [x, y] pairs.
 */
export function getCoords(geometry: GeoJSON.Geometry): GeoJSON.Position[] {
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

/**
 * Calculates the 2D bounding box ([SW, NE]) of an array of GeoJSON Geometries.
 * Returns null if the array is empty.
 */
export function calculateBoundingBox(geometries: GeoJSON.Geometry[]) {
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
