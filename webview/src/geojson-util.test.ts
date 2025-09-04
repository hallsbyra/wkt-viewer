import { describe, expect } from 'vitest'
import { calculateBoundingBox, getCoords } from './geojson-util'

describe('getCoords', () => {
    it('handles Point', () => {
        expect(getCoords({ type: 'Point', coordinates: [1, 2] })).toEqual([[1, 2]])
    })

    it('handles LineString', () => {
        expect(getCoords({ type: 'LineString', coordinates: [[1, 2], [3, 4]] })).toEqual([[1, 2], [3, 4]])
    })

    it('handles MultiPoint', () => {
        expect(getCoords({ type: 'MultiPoint', coordinates: [[5, 6], [7, 8]] })).toEqual([[5, 6], [7, 8]])
    })

    it('handles Polygon', () => {
        expect(getCoords({
            type: 'Polygon',
            coordinates: [
                [[1, 2], [3, 4], [5, 6], [1, 2]], // ring
                [[2, 3], [4, 5], [2, 3]] // hole
            ]
        })).toEqual([[1, 2], [3, 4], [5, 6], [1, 2], [2, 3], [4, 5], [2, 3]])
    })

    it('handles MultiLineString', () => {
        expect(getCoords({
            type: 'MultiLineString',
            coordinates: [
                [[1, 2], [3, 4]],
                [[5, 6], [7, 8]],
            ]
        })).toEqual([[1, 2], [3, 4], [5, 6], [7, 8]])
    })

    it('handles MultiPolygon', () => {
        expect(getCoords({
            type: 'MultiPolygon',
            coordinates: [
                [
                    [[1, 2], [3, 4], [1, 2]],
                ],
                [
                    [[5, 6], [7, 8], [5, 6]],
                ],
            ]
        })).toEqual([[1, 2], [3, 4], [1, 2], [5, 6], [7, 8], [5, 6]])
    })

    it('handles GeometryCollection', () => {
        expect(getCoords({
            type: 'GeometryCollection',
            geometries: [
                { type: 'Point', coordinates: [1, 2] },
                { type: 'LineString', coordinates: [[3, 4], [5, 6]] }
            ]
        })).toEqual([[1, 2], [3, 4], [5, 6]])
    })

    it('returns [] for unknown type', () => {
        expect(getCoords({ type: 'FakeType', coordinates: [] } as unknown as GeoJSON.Geometry)).toEqual([])
    })
})

describe('calculateBoundingBox', () => {
    it('returns null for empty array', () => {
        expect(calculateBoundingBox([])).toBeNull()
    })

    it('handles a single point', () => {
        expect(calculateBoundingBox([{ type: 'Point', coordinates: [3, 7] }])).toEqual([[7, 3], [7, 3]])
    })

    it('handles multiple geometries', () => {
        const geoms = [
            { type: 'Point' as const, coordinates: [1, 5] },
            { type: 'Point' as const, coordinates: [3, 7] },
            { type: 'Point' as const, coordinates: [2, 4] },
        ]
        expect(calculateBoundingBox(geoms)).toEqual([[4, 1], [7, 3]])
    })

    it('handles polygons', () => {
        const geoms = [
            {
                type: 'Polygon' as const,
                coordinates: [
                    [[1, 1], [2, 2], [3, 1], [1, 1]],
                ],
            },
            {
                type: 'Polygon' as const,
                coordinates: [
                    [[-2, -2], [0, 0], [-1, -3], [-2, -2]],
                ],
            },
        ]
        expect(calculateBoundingBox(geoms)).toEqual([[-3, -2], [2, 3]])
    })

    it('handles GeometryCollection', () => {
        const geoms = [
            {
                type: 'GeometryCollection' as const,
                geometries: [
                    { type: 'Point' as const, coordinates: [1, 2] },
                    { type: 'Point' as const, coordinates: [3, 4] },
                ],
            },
        ]
        expect(calculateBoundingBox(geoms)).toEqual([[2, 1], [4, 3]])
    })
})
