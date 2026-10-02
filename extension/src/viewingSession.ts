import { type TextDocumentContentChangeEvent } from 'vscode'
import { type TextRange, type ViewingScope } from '@wkt-viewer/shared'
import { updateScopeForChanges } from './scope.js'

type DocumentView = { scope: ViewingScope, locked: boolean, previous?: DocumentView }

/** Viewing scopes change explicitly through the padlock, independently of editor selections. */
export class ViewingSession {
    private readonly documents = new Map<string, DocumentView>()

    getView(uri: string): Readonly<DocumentView> {
        return this.documents.get(uri) ?? { scope: { kind: 'document' }, locked: false }
    }

    unlock(uri: string): void {
        const view = this.getView(uri)
        if (!view.locked) return
        this.documents.set(uri, view.previous ?? { scope: { kind: 'document' }, locked: false })
    }

    lockSelection(uri: string, ranges: TextRange[]): void {
        const view = this.getView(uri)
        if (view.locked) return
        const nonEmpty = ranges.filter(range => range.start < range.end).map(range => ({ ...range }))
        if (nonEmpty.length === 0) return
        this.documents.set(uri, {
            scope: { kind: 'selection', ranges: nonEmpty },
            locked: true,
            previous: view,
        })
    }

    updateDocument(uri: string, changes: readonly TextDocumentContentChangeEvent[]): void {
        if (changes.length === 0) return
        const view = this.documents.get(uri)
        if (view) this.documents.set(uri, updateViewForChanges(view, changes))
    }

    closeDocument(uri: string): void {
        this.documents.delete(uri)
    }

    dispose(): void {
        this.documents.clear()
    }
}

function updateViewForChanges(view: DocumentView, changes: readonly TextDocumentContentChangeEvent[]): DocumentView {
    return {
        ...view,
        scope: updateScopeForChanges(view.scope, changes),
        ...(view.previous && { previous: updateViewForChanges(view.previous, changes) }),
    }
}
