import { type TextDocumentContentChangeEvent } from 'vscode'
import { type ViewingScope, type WktToken } from '@wkt-viewer/shared'

export function filterTokensForScope(tokens: WktToken[], scope: ViewingScope, maxTokens: number): WktToken[] {
    const contained = scope.kind === 'area'
        ? tokens.filter(token => token.start >= scope.start && token.end <= scope.end)
        : tokens
    return contained.slice(0, maxTokens)
}

/** Keep a half-open area attached to its text through VS Code content changes. */
export function updateScopeForChanges(scope: ViewingScope, changes: readonly TextDocumentContentChangeEvent[]): ViewingScope {
    if (scope.kind !== 'area') return scope

    let { start, end } = scope
    // VS Code reports offsets in the pre-change document. Descending order keeps them valid.
    for (const change of [...changes].sort((a, b) => b.rangeOffset - a.rangeOffset)) {
        start = transformBoundary(start, change.rangeOffset, change.rangeLength, change.text.length, 'start')
        end = transformBoundary(end, change.rangeOffset, change.rangeLength, change.text.length, 'end')
    }
    return { kind: 'area', start: Math.min(start, end), end: Math.max(start, end) }
}

function transformBoundary(position: number, changeStart: number, removedLength: number, insertedLength: number, side: 'start' | 'end'): number {
    const changeEnd = changeStart + removedLength
    const delta = insertedLength - removedLength
    if (side === 'start') {
        if (position <= changeStart) return position
        if (position >= changeEnd) return position + delta
    } else {
        if (position < changeStart) return position
        if (position >= changeEnd) return position + delta
    }
    return side === 'start' ? changeStart : changeStart + insertedLength
}
