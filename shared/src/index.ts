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

export type MsgToWebview =
    | { command: 'update', wkt: WktToken[] }
    | { command: 'select', start: number, end: number, line: number }

export type MsgFromWebview =
    | { command: 'ready' }
    | { command: 'select', start: number, end: number }
