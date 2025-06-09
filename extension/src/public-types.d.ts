export type MsgToWebview =
    | { command: 'update', wkt: WktToken[] }
    | { command: 'select', start: number, end: number }

export type MsgFromWebview =
    | { command: 'select', start: number, end: number }


export { WktToken } from './wkt.js'