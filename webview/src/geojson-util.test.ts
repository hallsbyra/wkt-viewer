import * as assert from 'assert'
import { getCoords, calculateBoundingBox } from './geojson-util'

describe('getCoords', () => {
    test('handles Point', () => {
        assert.deepStrictEqual(
            getCoords({ type: 'Point', coordinates: [1, 2] }),
            [[1, 2]]
        )
    })

    test('handles LineString', () => {
        assert.deepStrictEqual(
            getCoords({ type: 'LineString', coordinates: [[1, 2], [3, 4]] }),
            [[1, 2], [3, 4]]
        )
    })

    test('handles MultiPoint', () => {
        assert.deepStrictEqual(
            getCoords({ type: 'MultiPoint', coordinates: [[5, 6], [7, 8]] }),
            [[5, 6], [7, 8]]
        )
    })

    test('handles Polygon', () => {
        assert.deepStrictEqual(
            getCoords({
                type: 'Polygon',
                coordinates: [
                    [[1, 2], [3, 4], [5, 6], [1, 2]], // ring
                    [[2, 3], [4, 5], [2, 3]] // hole
                ]
            }),
            [[1, 2], [3, 4], [5, 6], [1, 2], [2, 3], [4, 5], [2, 3]]
        )
    })

    test('handles MultiLineString', () => {
        assert.deepStrictEqual(
            getCoords({
                type: 'MultiLineString',
                coordinates: [
                    [[1, 2], [3, 4]],
                    [[5, 6], [7, 8]],
                ]
            }),
            [[1, 2], [3, 4], [5, 6], [7, 8]]
        )
    })

    test('handles MultiPolygon', () => {
        assert.deepStrictEqual(
            getCoords({
                type: 'MultiPolygon',
                coordinates: [
                    [
                        [[1, 2], [3, 4], [1, 2]],
                    ],
                    [
                        [[5, 6], [7, 8], [5, 6]],
                    ],
                ]
            }),
            [[1, 2], [3, 4], [1, 2], [5, 6], [7, 8], [5, 6]]
        )
    })

    test('handles GeometryCollection', () => {
        assert.deepStrictEqual(
            getCoords({
                type: 'GeometryCollection',
                geometries: [
                    { type: 'Point', coordinates: [1, 2] },
                    { type: 'LineString', coordinates: [[3, 4], [5, 6]] }
                ]
            }),
            [[1, 2], [3, 4], [5, 6]]
        )
    })

    test('returns [] for unknown type', () => {
        assert.deepStrictEqual(
            getCoords({ type: 'FakeType', coordinates: [] } as unknown as GeoJSON.Geometry),
            []
        )
    })
})

describe('calculateBoundingBox', () => {
    test('returns null for empty array', () => {
        assert.strictEqual(calculateBoundingBox([]), null)
    })

    test('handles a single point', () => {
        assert.deepStrictEqual(
            calculateBoundingBox([{ type: 'Point', coordinates: [3, 7] }]),
            [[7, 3], [7, 3]]
        )
    })

    test('handles multiple geometries', () => {
        const geoms = [
            { type: 'Point' as const, coordinates: [1, 5] },
            { type: 'Point' as const, coordinates: [3, 7] },
            { type: 'Point' as const, coordinates: [2, 4] },
        ]
        assert.deepStrictEqual(
            calculateBoundingBox(geoms),
            [[4, 1], [7, 3]]
        )
    })

    test('handles polygons', () => {
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
        assert.deepStrictEqual(
            calculateBoundingBox(geoms),
            [[-3, -2], [2, 3]]
        )
    })

    test('handles GeometryCollection', () => {
        const geoms = [
            {
                type: 'GeometryCollection' as const,
                geometries: [
                    { type: 'Point' as const, coordinates: [1, 2] },
                    { type: 'Point' as const, coordinates: [3, 4] },
                ],
            },
        ]
        assert.deepStrictEqual(
            calculateBoundingBox(geoms),
            [[2, 1], [4, 3]]
        )
    })
})
