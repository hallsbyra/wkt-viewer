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

    test('attaches same-line awkt metadata to the following WKT', () => {
        const input = '[awkt id=stroke-01234 tag=sweep-0007 label=01234 foo=bar] LINESTRING (0 0, 10 0)'
        const result = extractWkt(input)

        assert.equal(result.length, 1)
        assert.equal(result[0].wkt, 'LINESTRING (0 0, 10 0)')
        assert.deepStrictEqual(result[0].annotation, {
            fields: {
                id: 'stroke-01234',
                tag: 'sweep-0007',
                label: '01234',
                foo: 'bar',
            },
            id: 'stroke-01234',
            tag: 'sweep-0007',
            label: '01234',
            start: 0,
            end: input.indexOf(']') + 1,
            line: 0,
            endLine: 0,
        })
    })

    test('attaches next-line awkt metadata to the following WKT', () => {
        const input = '[awkt id=stroke-001 tag=sweep-01 label=1]\nLINESTRING (0 0, 10 0)'
        const result = extractWkt(input)

        assert.equal(result.length, 1)
        assert.equal(result[0].line, 1)
        assert.equal(result[0].annotation?.id, 'stroke-001')
        assert.equal(result[0].annotation?.line, 0)
    })

    test('attaches multiple inline awkt annotations on one line', () => {
        const input = '[DBG] Generated: [awkt id=stroke-002 tag=sweep-01 label=2] LINESTRING (10 0, 20 0), [awkt id=stroke-003 tag=sweep-02 label=3] LINESTRING (0 10, 20 10)'
        const result = extractWkt(input)

        assert.equal(result.length, 2)
        assert.equal(result[0].annotation?.id, 'stroke-002')
        assert.equal(result[0].annotation?.tag, 'sweep-01')
        assert.equal(result[1].annotation?.id, 'stroke-003')
        assert.equal(result[1].annotation?.tag, 'sweep-02')
    })

    test('uses awkt metadata only for the first following WKT', () => {
        const input = '[awkt id=stroke-001] POINT(0 0) POINT(1 1)'
        const result = extractWkt(input)

        assert.equal(result.length, 2)
        assert.equal(result[0].annotation?.id, 'stroke-001')
        assert.equal(result[1].annotation, undefined)
    })

    test('replaces orphan awkt metadata when another annotation appears before WKT', () => {
        const input = '[awkt id=orphan] no geometry here [awkt id=stroke-001] POINT(0 0)'
        const result = extractWkt(input)

        assert.equal(result.length, 1)
        assert.equal(result[0].annotation?.id, 'stroke-001')
    })

    test('ignores malformed awkt annotations without dropping nearby WKT', () => {
        const input = '[awkt id] POINT(0 0) [awkt id=] POINT(1 1)'
        const result = extractWkt(input)

        assert.equal(result.length, 2)
        assert.equal(result[0].wkt, 'POINT(0 0)')
        assert.equal(result[0].annotation, undefined)
        assert.equal(result[1].wkt, 'POINT(1 1)')
        assert.equal(result[1].annotation, undefined)
    })
})
