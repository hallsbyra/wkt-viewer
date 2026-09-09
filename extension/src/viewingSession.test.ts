import * as assert from 'assert'
import { ViewingSession } from './viewingSession.js'

const source = { uri: 'file:///test.cs', version: 1, filename: 'test.cs' }

suite('automatic viewing area', () => {
    test('uses an existing selection when the viewer opens without replacing a saved area', () => {
        const session = new ViewingSession(() => {}, 1)
        session.initializeFromSelection(source, 10, 20)
        assert.deepStrictEqual(session.getView(source.uri), { scope: { kind: 'area', start: 10, end: 20 }, locked: false })

        session.setAreaLocked(source.uri, true)
        session.initializeFromSelection(source, 30, 40)
        assert.deepStrictEqual(session.getView(source.uri), { scope: { kind: 'area', start: 10, end: 20 }, locked: true })
    })

    test('uses every non-empty selection as an area and a click outside returns to the document', async () => {
        const changes: unknown[] = []
        const session = new ViewingSession(source => changes.push(source), 1)
        session.selectionChanged(source, 10, 11, true)
        await waitForSelection()
        assert.deepStrictEqual(session.getView(source.uri), { scope: { kind: 'area', start: 10, end: 11 }, locked: false })
        assert.deepStrictEqual(changes, [source])

        // Clicking inside selects a geometry in the viewer, but keeps the area and map extent.
        session.selectionChanged(source, 10, 10, true)
        await waitForSelection()
        assert.deepStrictEqual(changes, [source])

        session.selectionChanged(source, 11, 11, true)
        await waitForSelection()
        assert.deepStrictEqual(session.getView(source.uri), { scope: { kind: 'document' }, locked: false })
        assert.deepStrictEqual(changes, [source, source])
    })

    test('ignores viewer navigation, pauses while locked, and only follows the latest selection', async () => {
        const changes: unknown[] = []
        const session = new ViewingSession(source => changes.push(source), 1)
        session.selectionChanged(source, 10, 20, false)
        await waitForSelection()
        assert.deepStrictEqual(session.getView(source.uri), { scope: { kind: 'document' }, locked: false })

        session.selectionChanged(source, 10, 20, true)
        await waitForSelection()
        session.setAreaLocked(source.uri, true)
        session.selectionChanged(source, 30, 40, true)
        await waitForSelection()
        assert.deepStrictEqual(session.getView(source.uri), { scope: { kind: 'area', start: 10, end: 20 }, locked: true })

        session.setAreaLocked(source.uri, false)
        session.selectionChanged(source, 30, 40, true)
        session.selectionChanged(source, 50, 60, true)
        await waitForSelection()
        assert.deepStrictEqual(session.getView(source.uri), { scope: { kind: 'area', start: 50, end: 60 }, locked: false })
        assert.strictEqual(changes.length, 2)
    })
})

function waitForSelection(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 5))
}
