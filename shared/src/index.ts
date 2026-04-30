export type WktToken = {
    wkt: string
    start: number
    end: number
    line: number
    endLine: number
}

export type MsgToWebview =
    | { command: 'update', wkt: WktToken[] }
    | { command: 'select', start: number, end: number, line: number }

export type MsgFromWebview =
    | { command: 'select', start: number, end: number }
