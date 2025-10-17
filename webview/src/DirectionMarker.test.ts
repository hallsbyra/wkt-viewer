import { describe, expect } from 'vitest'
import { getDirectionMarkerInfo } from './DirectionMarker'

// Helper to round numbers for stable assertions
function round(n: number, d = 6) { return Math.round(n * 10 ** d) / 10 ** d }
function roundPoint(p: [number, number]): [number, number] { return [round(p[0]), round(p[1])] }

function sut(geom: GeoJSON.Geometry) {
    return getDirectionMarkerInfo(geom).map(a => ({ pos: roundPoint(a.pos), angleDeg: round(a.angleDeg, 4) }))
}

describe('getDirectionMarkerInfo', () => {
    it('returns [] for unsupported geometry types', () => {
        expect(sut({ type: 'Point', coordinates: [1, 2] })).toEqual([])
        expect(sut({ type: 'MultiPoint', coordinates: [[1, 2], [3, 4]] })).toEqual([])
        expect(sut({ type: 'GeometryCollection', geometries: [] })).toEqual([])
    })

    it('returns single marker for two-point 45 deg LineString', () => {
        const info = sut({ type: 'LineString', coordinates: [[0, 0], [1, 1]] })
        expect(info).toHaveLength(1)
        expect(info[0].pos).toEqual([0.5, 0.5])
        expect(info[0].angleDeg).toBe(45)
    })

    it('returns single marker for two-point horizontal LineString', () => {
        const info = sut({ type: 'LineString', coordinates: [[0, 0], [1, 0]] })
        expect(info).toHaveLength(1)
        expect(info[0].pos).toEqual([0.5, 0])
        expect(info[0].angleDeg).toBe(0)
    })

    it('returns two markers for two-segment LineString', () => {
        const info = sut({ type: 'LineString', coordinates: [[0, 0], [10, 0], [10, 10]] })
        expect(info).toHaveLength(2)
        expect(info[0].pos).toEqual([5, 0]) // between (0,0)-(10,0)
        expect(info[0].angleDeg).toBe(0)
        expect(info[1].pos).toEqual([10, 5]) // between (10,0)-(10,10)
        expect(info[1].angleDeg).toBe(90)
    })

    it('returns correct angles for all quadrants in a rhombus', () => {
        const geom: GeoJSON.LineString = { type: 'LineString', coordinates: [[0, 0], [1, 1], [0, 2], [-1, 1], [0, 0]] }
        const info = sut(geom)
        // segments directions: NE(45), NW(135), SW(-135), SE(-45)
        const angles = info.map(a => a.angleDeg)
        expect(angles).toEqual([45, 135, -135, -45])
    })

    it('returns two markers for a MultiLineString with two segments', () => {
        const info = sut({ type: 'MultiLineString', coordinates: [[[0, 0], [2, 0]], [[2, 2], [2, 4]]] })
        expect(info).toHaveLength(2)
        expect(info[0].pos).toEqual([1, 0])
        expect(info[0].angleDeg).toBe(0)
        expect(info[1].pos).toEqual([2, 3])
        expect(info[1].angleDeg).toBe(90)
    })

    it('Polygon includes all rings (outer + hole)', () => {
        const geom: GeoJSON.Polygon = {
            type: 'Polygon' as const, coordinates: [
                [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]], // outer (4 segments)
                [[1, 1], [1, 2], [2, 2], [1, 1]] // hole (3 segments)
            ]
        }
        const info = sut(geom)
        // 7 total segments
        expect(info).toHaveLength(7)
    })

    it('MultiPolygon includes all polygons and rings', () => {
        const geom: GeoJSON.MultiPolygon = {
            type: 'MultiPolygon', coordinates: [
                [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]], // square 1 (4 segments)
                [[[10, 10], [12, 10], [12, 12], [10, 12], [10, 10]], [[10.5, 10.5], [10.5, 11], [11, 11], [10.5, 10.5]]] // square 2 + hole (4 + 3)
            ]
        }
        const info = sut(geom)
        expect(info).toHaveLength(11)
    })

    it('skips zero-length segments', () => {
        const geom: GeoJSON.LineString = { type: 'LineString', coordinates: [[0, 0], [0, 0], [1, 0]] }
        const info = sut(geom)
        // segments: (0,0)-(0,0) length 0 skipped, (0,0)-(1,0) kept
        expect(info).toHaveLength(1)
        expect(info[0].pos).toEqual([0.5, 0])
        expect(info[0].angleDeg).toBe(0)
    })

    it('GeometryCollection recurses into nested geometries', () => {
        const geom: GeoJSON.GeometryCollection = {
            type: 'GeometryCollection',
            geometries: [
                { type: 'LineString', coordinates: [[0, 0], [2, 0]] },
                { type: 'Polygon', coordinates: [[[10, 10], [12, 10], [12, 12], [10, 10]]] },
                {
                    type: 'GeometryCollection',
                    geometries: [
                        { type: 'MultiLineString', coordinates: [[[20, 20], [21, 20], [21, 21]], [[30, 30], [30, 31]]] }
                    ]
                }
            ]
        }
        const info = sut(geom)
        expect(info).toHaveLength(7)
        expect(info).toContainEqual({ pos: [1, 0], angleDeg: 0 })
        expect(info).toContainEqual({ pos: [11, 10], angleDeg: 0 })
        expect(info).toContainEqual({ pos: [20.5, 20], angleDeg: 0 })
        expect(info).toContainEqual({ pos: [30, 30.5], angleDeg: 90 })
    })
})
