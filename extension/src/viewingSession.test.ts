import * as assert from 'assert'
import { ViewingSession } from './viewingSession.js'

const uri = 'file:///test.cs'

suite('explicit viewing selection', () => {
    test('locks separate ranges, follows edits and restores the preceding view', () => {
        const session = new ViewingSession()
        session.lockSelection(uri, [{ start: 20, end: 30 }, { start: 60, end: 70 }])
        assert.deepStrictEqual(session.getView(uri).scope, {
            kind: 'selection', ranges: [{ start: 20, end: 30 }, { start: 60, end: 70 }],
        })
        assert.strictEqual(session.getView(uri).locked, true)
        session.updateDocument(uri, [{ rangeOffset: 0, rangeLength: 0, text: 'abc' }] as never)
        assert.deepStrictEqual(session.getView(uri).scope, {
            kind: 'selection', ranges: [{ start: 23, end: 33 }, { start: 63, end: 73 }],
        })
        session.unlock(uri)
        assert.deepStrictEqual(session.getView(uri), { scope: { kind: 'document' }, locked: false })
        session.dispose()
    })

    test('keeps the locked subset unchanged until unlocked and copies input ranges', () => {
        const session = new ViewingSession()
        const ranges = [{ start: 10, end: 20 }]
        session.lockSelection(uri, ranges)
        ranges[0].end = 100
        session.lockSelection(uri, [{ start: 30, end: 40 }])
        assert.deepStrictEqual(session.getView(uri).scope, { kind: 'selection', ranges: [{ start: 10, end: 20 }] })
        session.unlock(uri)
        session.lockSelection(uri, [{ start: 30, end: 40 }])
        assert.deepStrictEqual(session.getView(uri).scope, { kind: 'selection', ranges: [{ start: 30, end: 40 }] })
        session.unlock(uri)
        assert.deepStrictEqual(session.getView(uri), { scope: { kind: 'document' }, locked: false })
        session.dispose()
    })

    test('keeps document locks independent and forgets them when a document closes', () => {
        const session = new ViewingSession()
        session.lockSelection(uri, [{ start: 10, end: 20 }])
        assert.deepStrictEqual(session.getView('other'), { scope: { kind: 'document' }, locked: false })
        session.lockSelection('other', [{ start: 30, end: 40 }])
        session.closeDocument(uri)
        assert.deepStrictEqual(session.getView(uri), { scope: { kind: 'document' }, locked: false })
        assert.strictEqual(session.getView('other').locked, true)
        session.dispose()
        assert.deepStrictEqual(session.getView('other'), { scope: { kind: 'document' }, locked: false })
    })

    test('does not lock empty selections and allows unlocking after every selected shape is deleted', () => {
        const session = new ViewingSession()
        session.lockSelection(uri, [{ start: 10, end: 10 }])
        assert.deepStrictEqual(session.getView(uri), { scope: { kind: 'document' }, locked: false })
        session.unlock(uri)
        session.lockSelection(uri, [{ start: 10, end: 20 }])
        session.updateDocument(uri, [{ rangeOffset: 10, rangeLength: 10, text: '' }] as never)
        assert.deepStrictEqual(session.getView(uri).scope, { kind: 'selection', ranges: [{ start: 10, end: 10 }] })
        assert.strictEqual(session.getView(uri).locked, true)
        session.unlock(uri)
        assert.deepStrictEqual(session.getView(uri), { scope: { kind: 'document' }, locked: false })
        session.dispose()
    })
})
