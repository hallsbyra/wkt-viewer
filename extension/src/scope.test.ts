import * as assert from 'assert'
import { filterTokensForScope, updateScopeForChanges } from './scope.js'

suite('viewing scope', () => {
    test('filters complete tokens before applying the geometry limit', () => {
        const tokens = [
            { wkt: 'POINT(0 0)', start: 0, end: 10, line: 0, endLine: 0 },
            { wkt: 'POINT(1 1)', start: 20, end: 30, line: 1, endLine: 1 },
            { wkt: 'POINT(2 2)', start: 40, end: 50, line: 2, endLine: 2 },
        ]
        assert.deepStrictEqual(filterTokensForScope(tokens, { kind: 'area', start: 20, end: 50 }, 1), [tokens[1]])
        assert.deepStrictEqual(filterTokensForScope(tokens, { kind: 'area', start: 21, end: 50 }, 5), [tokens[2]])
    })

    test('keeps insertions at both boundaries inside the area', () => {
        const change = (rangeOffset: number, rangeLength: number, text: string) => ({ rangeOffset, rangeLength, text })
        assert.deepStrictEqual(updateScopeForChanges({ kind: 'area', start: 10, end: 20 }, [change(10, 0, 'abc')] as never), { kind: 'area', start: 10, end: 23 })
        assert.deepStrictEqual(updateScopeForChanges({ kind: 'area', start: 10, end: 20 }, [change(20, 0, 'abc')] as never), { kind: 'area', start: 10, end: 23 })
    })

    test('leaves a deleted area active and empty', () => {
        const change = { rangeOffset: 10, rangeLength: 10, text: '' }
        assert.deepStrictEqual(updateScopeForChanges({ kind: 'area', start: 10, end: 20 }, [change] as never), { kind: 'area', start: 10, end: 10 })
    })
})
