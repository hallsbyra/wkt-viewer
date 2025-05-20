import assert from 'assert'
import { extractWkt } from '../wkt.js'

suite('extractWkt', () => {
    test('extracts single valid WKT from a string', () => {
        const input = 'POINT (30 10)'
        const expected = ['POINT (30 10)']
        const result = extractWkt(input)
        assert.deepStrictEqual(result, expected)
    })

    test('extracts multiple valid WKT from a string', () => {
        const input = 'POINT (30 10) and something else then POINT (40 20)'
        const expected = ['POINT (30 10)', 'POINT (40 20)']
        const result = extractWkt(input)
        assert.deepStrictEqual(result, expected)
    })

    test('extracts WKT with nested parenthesis', () => {
        const input = `
        POLYGON ((-85.57993 192.87844, -59.26594 219.19242, -16.97565 176.90214, -43.28964 150.58815, -85.57993 192.87844))
        `
        const expected = [
            'POLYGON ((-85.57993 192.87844, -59.26594 219.19242, -16.97565 176.90214, -43.28964 150.58815, -85.57993 192.87844))', 
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
            'POLYGON ((-85.57993 192.87844, -59.26594 219.19242, -16.97565 176.90214, -43.28964 150.58815, -85.57993 192.87844))', 
            'GEOMETRYCOLLECTION (POINT (20 10), LINESTRING (30 10, 10 30, 40 40))',
            'GEOMETRYCOLLECTION (GEOMETRYCOLLECTION(POINT (20 10)), GEOMETRYCOLLECTION(LINESTRING (30 10, 10 30, 40 40)))',
            'POLYGON ((8.45 28.15, 17.3 28.15, 17.3 21.1, 8.45 21.1, 8.45 28.15), (10.75 26.15, 14.2 26.15, 14.2 23.5, 10.75 23.5, 10.75 26.15))',
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



})
