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

export type ViewingScope =
    | { kind: 'document' }
    | { kind: 'area', start: number, end: number }

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
        captureAvailable: boolean
        areaLineRange?: { start: number, end: number }
        fitId: number
    }
    | { command: 'select', source: SourceDocument, start: number, end: number, line: number }

export type MsgFromWebview =
    | { command: 'ready' }
    | { command: 'select', source: SourceDocument, start: number, end: number }
    | { command: 'captureArea', source: SourceDocument }
    | { command: 'showDocument', source: SourceDocument }
    | { command: 'fitAll', source: SourceDocument }
