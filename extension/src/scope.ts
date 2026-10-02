import { type TextDocumentContentChangeEvent } from 'vscode'
import { type TextRange, type ViewingScope, type WktToken } from '@wkt-viewer/shared'

export function filterTokensForScope(tokens: WktToken[], scope: ViewingScope, maxTokens: number): WktToken[] {
    const ranges = scope.kind === 'area' ? [scope] : scope.kind === 'selection' ? scope.ranges : undefined
    const contained = ranges
        ? tokens.filter(token => ranges.some(range => token.start >= range.start && token.end <= range.end))
        : tokens
    return contained.slice(0, maxTokens)
}

/** Keep a half-open area attached to its text through VS Code content changes. */
export function updateScopeForChanges(scope: ViewingScope, changes: readonly TextDocumentContentChangeEvent[]): ViewingScope {
    if (scope.kind === 'selection') {
        return { kind: 'selection', ranges: scope.ranges.map(range => updateRangeForChanges(range, changes)) }
    }
    if (scope.kind !== 'area') return scope
    return { kind: 'area', ...updateRangeForChanges(scope, changes) }
}

function updateRangeForChanges(range: TextRange, changes: readonly TextDocumentContentChangeEvent[]): TextRange {
    let { start, end } = range
    // VS Code reports offsets in the pre-change document. Descending order keeps them valid.
    for (const change of [...changes].sort((a, b) => b.rangeOffset - a.rangeOffset)) {
        start = transformBoundary(start, change.rangeOffset, change.rangeLength, change.text.length, 'start')
        end = transformBoundary(end, change.rangeOffset, change.rangeLength, change.text.length, 'end')
    }
    return { start: Math.min(start, end), end: Math.max(start, end) }
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
