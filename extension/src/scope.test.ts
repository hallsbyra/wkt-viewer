import * as assert from 'assert'
import { filterTokensForScope, updateScopeForChanges } from './scope.js'

suite('viewing scope', () => {
    test('shows only complete WKT in separate ranges without filling the gaps or duplicating tokens', () => {
        const tokens = [0, 20, 40, 60].map(start => ({ wkt: 'POINT(0 0)', start, end: start + 10, line: 0, endLine: 0 }))
        const scope = { kind: 'selection' as const, ranges: [{ start: 0, end: 10 }, { start: 40, end: 50 }, { start: 40, end: 65 }] }
        assert.deepStrictEqual(filterTokensForScope(tokens, scope, 10), [tokens[0], tokens[2]])
        assert.deepStrictEqual(filterTokensForScope(tokens, scope, 1), [tokens[0]])
    })

    test('moves separate ranges through simultaneous edits in the original document coordinates', () => {
        const scope = { kind: 'selection' as const, ranges: [{ start: 10, end: 20 }, { start: 40, end: 50 }] }
        const changes = [{ rangeOffset: 5, rangeLength: 0, text: 'abc' }, { rangeOffset: 40, rangeLength: 10, text: '' }]
        assert.deepStrictEqual(updateScopeForChanges(scope, changes as never), {
            kind: 'selection', ranges: [{ start: 13, end: 23 }, { start: 43, end: 43 }],
        })
    })

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
