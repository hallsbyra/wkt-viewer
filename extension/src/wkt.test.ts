import assert from 'assert'
import { extractWkt } from './wkt.js'

suite('extractWkt', () => {
    test('extracts single valid WKT from a string', () => {
        const input = 'POINT (30 10)'
        const expected = [{ start: 0, end: 13, wkt: 'POINT (30 10)', line: 0, endLine: 0 }]
        const result = extractWkt(input)
        assert.deepStrictEqual(result, expected)
    })

    test('extracts multiple valid WKT from a string', () => {
        const input = 'POINT (30 10) and something else then POINT (40 20)'
        const expected = [{
            start: 0,
            end: 13,
            wkt: 'POINT (30 10)',
            line: 0,
            endLine: 0,
        }, {
            start: 38,
            end: 51,
            wkt: 'POINT (40 20)',
            line: 0,
            endLine: 0,
        }]
        const result = extractWkt(input)
        assert.deepStrictEqual(result, expected)
    })

    test('extracts WKT with nested parenthesis', () => {
        const input = `
        POLYGON ((-85.57993 192.87844, -59.26594 219.19242, -16.97565 176.90214, -43.28964 150.58815, -85.57993 192.87844))
        `
        const expected = [
            {
                start: 9,
                end: 124,
                wkt: 'POLYGON ((-85.57993 192.87844, -59.26594 219.19242, -16.97565 176.90214, -43.28964 150.58815, -85.57993 192.87844))',
                line: 1,
                endLine: 1,
            }
        ]
        const result = extractWkt(input)
        assert.deepStrictEqual(result, expected)
    })

    test('extracts complex WKT', () => {
        const input = `
# Here's a POLYGON
POLYGON ((-85.57993 192.87844, -59.26594 219.19242, -16.97565 176.90214, -43.28964 150.58815, -85.57993 192.87844))
# A GEOMETRYCOLLECTION
GEOMETRYCOLLECTION (POINT (20 10), LINESTRING (30 10, 10 30, 40 40))
# And a nested GEOMETRYCOLLECTION
GEOMETRYCOLLECTION (GEOMETRYCOLLECTION(POINT (20 10)), GEOMETRYCOLLECTION(LINESTRING (30 10, 10 30, 40 40)))
# And a POLYGON with holes
POLYGON ((8.45 28.15, 17.3 28.15, 17.3 21.1, 8.45 21.1, 8.45 28.15), (10.75 26.15, 14.2 26.15, 14.2 23.5, 10.75 23.5, 10.75 26.15))
        `
        const expected = [
            { start: 20, end: 135,  line: 2, endLine: 2, wkt: 'POLYGON ((-85.57993 192.87844, -59.26594 219.19242, -16.97565 176.90214, -43.28964 150.58815, -85.57993 192.87844))' },
            { start: 159, end: 227, line: 4, endLine: 4, wkt: 'GEOMETRYCOLLECTION (POINT (20 10), LINESTRING (30 10, 10 30, 40 40))' },
            { start: 262, end: 370, line: 6, endLine: 6, wkt: 'GEOMETRYCOLLECTION (GEOMETRYCOLLECTION(POINT (20 10)), GEOMETRYCOLLECTION(LINESTRING (30 10, 10 30, 40 40)))' },
            { start: 398, end: 529, line: 8, endLine: 8, wkt: 'POLYGON ((8.45 28.15, 17.3 28.15, 17.3 21.1, 8.45 21.1, 8.45 28.15), (10.75 26.15, 14.2 26.15, 14.2 23.5, 10.75 23.5, 10.75 26.15))' },
        ]
        const result = extractWkt(input)
        assert.deepStrictEqual(result, expected)
    })

    test('extracts multi line WKT', () => {
        const input = `
POLYGON (
    (1.1 1.1, 2.2 2.2)
)
        `
        const expected = [
            { start: 1, end: 35,  line: 1, endLine: 3, wkt: 'POLYGON (\n    (1.1 1.1, 2.2 2.2)\n)' },
        ]
        const result = extractWkt(input)
        assert.deepStrictEqual(result, expected)
    })

    test('malformed WKT', () => {
        const input = `
        GEOMETRYCOLLECTION (LINESTRING (19.3 9.85, 20.25 10.2, 21.1 10.9, 21.9 11.6, 22.7 12.3, 23.5 13, 24.4 13.7, 25.45 14.6, 26.3 15.3, 27.05 16, 28 16.7, 28.8 17.4, 29.55 18.1, 30.3 18.8, 31.2 19.65, 32.35 20.7, 33.1 21.4, 34.25 22.45, 35.1 23.3, 36.1 24.2, 37 25.1, 38.4 26.3, 39.25 27.1, 40.3 28, 41.4 29, 42.55 30, 43.8 31, 44.8 31.85, 45.6 32.5, 46.45 33.25, 47.2 34, 14.6 32.8), 
        `
        const result = extractWkt(input)
        assert.deepStrictEqual(result, [])
    })

    test('respects maxTokens parameter', () => {
        const input = 'POINT (30 10) POINT (40 20) POINT (50 30)'
        const expected = [{ start: 0, end: 13, wkt: 'POINT (30 10)', line: 0, endLine: 0 }]
        const result = extractWkt(input, 1)
        assert.deepStrictEqual(result, expected)
    })

    test('recovers if a WKT contains illegal characters', () => {
        const input = `
            GEOMETRYCOLLECTION(LINESTRING(1 2, this text is illegal, but parser should recover
            POINT(1 2)
        `
        const result = extractWkt(input)
        assert.equal(result.length, 1)
        assert.equal(result[0].wkt, 'POINT(1 2)')
    })

    test('handles EMPTY geometries', () => {
        const input = `
            POINT(1 1)
            LINESTRING EMPTY
            POINT(2 2)
        `
        const result = extractWkt(input)
        assert.equal(result[0].wkt, 'POINT(1 1)')
        assert.equal(result[1].wkt, 'LINESTRING EMPTY')
        assert.equal(result[2].wkt, 'POINT(2 2)')
    })
})