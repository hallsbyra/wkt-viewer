import { describe, it, expect } from 'vitest'
import { WktToken } from '../../extension/src/wkt'
import { wktTokensToGeomObjects } from './App'

describe('wktTokensToGeomObjects', () => {
    const tokens: WktToken[] = [
        { start: 0, end: 10, line: 0, endLine: 0, wkt: 'POINT(1 1)' },
        { start: 11, end: 22, line: 1, endLine: 1, wkt: 'LINESTRING(0 0,1 1)' },
        { start: 23, end: 34, line: 2, endLine: 2, wkt: 'LINESTRING EMPTY' },
        { start: 35, end: 45, line: 3, endLine: 3, wkt: 'POINT(2 2)' },
    ]
    const geomObjects = wktTokensToGeomObjects(tokens)

    it('creates one geometry per token (count + order)', () => {
        expect(geomObjects).toHaveLength(4)
        expect(geomObjects.map(g => g.feature.geometry.type)).toEqual([
            'Point', 'LineString', 'LineString', 'Point'
        ])
    })

    it('parses Point geometries', () => {
        expect(geomObjects[0].feature.geometry.type).toBe('Point')
        expect(geomObjects[3].feature.geometry.type).toBe('Point')
    })

    it('parses LineString geometry', () => {
        expect(geomObjects[1].feature.geometry.type).toBe('LineString')
        expect((geomObjects[1].feature.geometry as GeoJSON.LineString).coordinates).toEqual([[0, 0], [1, 1]])
    })

    it('parses EMPTY LineString geometry', () => {
        expect(geomObjects[2].feature.geometry.type).toBe('LineString')
        expect((geomObjects[2].feature.geometry as GeoJSON.LineString).coordinates).toEqual([])
    })
})