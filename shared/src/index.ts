export type WktAnnotation = {
    fields: Record<string, string>
    id?: string
    tag?: string
    label?: string
    start: number
    end: number
    line: number
    endLine: number
}

export type WktToken = {
    wkt: string
    start: number
    end: number
    line: number
    endLine: number
    annotation?: WktAnnotation
}

export type TextRange = { start: number, end: number }

export type ViewingScope =
    | { kind: 'document' }
    | { kind: 'area', start: number, end: number }
    | { kind: 'selection', ranges: TextRange[] }

export type SourceDocument = {
    uri: string
    version: number
    filename: string
}

export type MsgToWebview =
    | {
        command: 'update'
        wkt: WktToken[]
        source: SourceDocument
        scope: ViewingScope
        viewLocked: boolean
        areaLineRange?: { start: number, end: number }
        fitId: number
    }
    | {
        command: 'select'
        source: SourceDocument
        ranges: TextRange[]
    }

export type ViewingCommand =
    | { command: 'fitAll' }
    | { command: 'selectArea' }
    | { command: 'setSelectionLocked', locked: true, ranges: TextRange[] }
    | { command: 'setSelectionLocked', locked: false }

export type MsgFromWebview =
    | { command: 'ready' }
    | { command: 'select', source: SourceDocument, ranges: TextRange[] }
    | (ViewingCommand & { source: SourceDocument })
