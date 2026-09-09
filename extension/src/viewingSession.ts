import { type TextDocumentContentChangeEvent } from 'vscode'
import { type SourceDocument, type ViewingScope } from '@wkt-viewer/shared'
import { updateScopeForChanges } from './scope.js'

type DocumentView = { scope: ViewingScope, locked: boolean }

/** Owns viewing areas independently of the editor's geometry selection. */
export class ViewingSession {
    private readonly documents = new Map<string, DocumentView>()
    private pending?: { source: SourceDocument, timer: ReturnType<typeof setTimeout> }

    constructor(
        private readonly onScopeChanged: (source: SourceDocument) => void,
        private readonly delay = 200,
    ) {}

    getView(uri: string): Readonly<DocumentView> {
        return this.documents.get(uri) ?? { scope: { kind: 'document' }, locked: false }
    }

    setAreaLocked(uri: string, locked: boolean): void {
        this.cancelPendingSelection()
        const view = this.getView(uri)
        if (view.scope.kind === 'area') this.documents.set(uri, { ...view, locked })
    }

    initializeFromSelection(source: SourceDocument, start: number, end: number): void {
        if (this.documents.has(source.uri)) return

        const scope = scopeForSelection({ kind: 'document' }, start, end)
        if (scope.kind === 'area') this.documents.set(source.uri, { scope, locked: false })
    }

    selectionChanged(source: SourceDocument, start: number, end: number, userInitiated: boolean): void {
        this.cancelPendingSelection()
        if (!userInitiated || this.getView(source.uri).locked) return

        this.pending = {
            source,
            timer: setTimeout(() => {
                this.pending = undefined
                const previous = this.getView(source.uri).scope
                const next = scopeForSelection(previous, start, end)
                if (next === previous) return

                this.documents.set(source.uri, { scope: next, locked: false })
                this.onScopeChanged(source)
            }, this.delay),
        }
    }

    updateDocument(uri: string, changes: readonly TextDocumentContentChangeEvent[]): void {
        if (changes.length === 0) return
        if (this.pending?.source.uri === uri) this.cancelPendingSelection()
        const view = this.documents.get(uri)
        if (view) this.documents.set(uri, { ...view, scope: updateScopeForChanges(view.scope, changes) })
    }

    closeDocument(uri: string): void {
        if (this.pending?.source.uri === uri) this.cancelPendingSelection()
        this.documents.delete(uri)
    }

    cancelPendingSelection(): void {
        if (this.pending) clearTimeout(this.pending.timer)
        this.pending = undefined
    }

    dispose(): void {
        this.cancelPendingSelection()
        this.documents.clear()
    }
}

function scopeForSelection(scope: ViewingScope, start: number, end: number): ViewingScope {
    if (start !== end) {
        if (scope.kind === 'area' && scope.start === start && scope.end === end) return scope
        return { kind: 'area', start, end }
    }
    if (scope.kind === 'area' && (start < scope.start || start >= scope.end)) return { kind: 'document' }
    return scope
}
