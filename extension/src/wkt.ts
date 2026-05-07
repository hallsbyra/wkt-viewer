import { type WktAnnotation, type WktToken } from '@wkt-viewer/shared'

export type { WktToken } from '@wkt-viewer/shared'

/*──────────────────────────── helpers ────────────────────────────*/

const enum CC {
    A = 65, Z = 90, a = 97, z = 122,
    LParen = 40, RParen = 41, LBracket = 91, NL = 10,
}

const ANNOTATION_KEYWORD = 'AWKT'
const ANNOTATION_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/

const TOP = [
    'POINT', 'LINESTRING', 'POLYGON',
    'MULTIPOINT', 'MULTILINESTRING', 'MULTIPOLYGON',
    'GEOMETRYCOLLECTION',
] as const
type TOPKW = (typeof TOP)[number]

/** fast ASCII alpha check */
const isAlpha = (c: number) =>
    (c >= CC.A && c <= CC.Z) || (c >= CC.a && c <= CC.z)

type AnnotationParseResult = {
    annotation?: WktAnnotation
    consumed: boolean
    end: number
    endLine: number
}

/*───────────────────────── core parser ───────────────────────────*/

export function extractWkt(
    input: string,
    maxTokens: number = Infinity,
): WktToken[] {

    const len = input.length
    const upper = input.toUpperCase()    // cheap shadow string
    const out: WktToken[] = []

    let i = 0                // cursor
    let line = 0             // current 0-based line number
    let pendingAnnotation: WktAnnotation | undefined

    while (i < len && out.length < maxTokens) {

        /* ---- fast-skip non-letters while counting newlines ---- */
        while (i < len && !isAlpha(upper.charCodeAt(i))) {
            if (input.charCodeAt(i) === CC.NL) line++
            i++
        }
        if (i >= len) break

        /* ---- read word, record its starting line ---- */
        const wordStart = i
        const startLine = line

        while (i < len && isAlpha(upper.charCodeAt(i))) i++
        const word = upper.slice(wordStart, i)

        if (word === ANNOTATION_KEYWORD && wordStart > 0 && input.charCodeAt(wordStart - 1) === CC.LBracket) {
            const result = parseAwktAnnotation(input, wordStart - 1, startLine)
            pendingAnnotation = result.annotation
            if (result.consumed) {
                i = result.end
                line = result.endLine
            }
            continue
        }

        if (!TOP.includes(word as TOPKW)) continue         // not a WKT keyword

        /* ---- skip whitespace (tracking newlines) ---- */
        while (i < len && /\s/.test(input[i])) {
            if (input.charCodeAt(i) === CC.NL) line++
            i++
        }

        /* ---- handle EMPTY (no parentheses) ---- */
        if (upper.startsWith('EMPTY', i)) {
            const end = i + 5
            const token: WktToken = {
                wkt: input.slice(wordStart, end),
                start: wordStart, end,
                line: startLine,
                endLine: line
            }
            if (pendingAnnotation) token.annotation = pendingAnnotation
            out.push(token)
            pendingAnnotation = undefined
            i = end
            continue
        }

        /* ---- expect '(' and walk to matching ')' with recovery ---- */
        if (input.charCodeAt(i) !== CC.LParen) {
            // Malformed: no opening paren after keyword, advance one char to recover
            i = wordStart + 1
            line = startLine
            continue
        }

        const { endIdx, endLine, recoveredAt } = findMatchingParenWithLineRecover(input, i, line)
        if (endIdx === -1) {
            // Unmatched or gave up: attempt resync after the point we gave up
            i = recoveredAt > wordStart ? recoveredAt : (wordStart + 1)
            if (i >= len) break
            continue
        }

        const token: WktToken = {
            wkt: input.slice(wordStart, endIdx + 1),
            start: wordStart, end: endIdx + 1,
            line: startLine,
            endLine
        }
        if (pendingAnnotation) token.annotation = pendingAnnotation
        out.push(token)
        pendingAnnotation = undefined

        i = endIdx + 1
        line = endLine
    }

    return out
}

function parseAwktAnnotation(str: string, start: number, startLine: number): AnnotationParseResult {
    const len = str.length
    const nl = str.indexOf('\n', start)
    const cr = str.indexOf('\r', start)
    const lineEnd = Math.min(
        nl === -1 ? len : nl,
        cr === -1 ? len : cr,
    )
    const close = str.indexOf(']', start)

    if (close === -1 || close > lineEnd) {
        return { consumed: false, end: start, endLine: startLine }
    }

    const body = str.slice(start + ANNOTATION_KEYWORD.length + 1, close).trim()
    const fields = parseAwktFields(body)

    if (!fields) {
        return { consumed: true, end: close + 1, endLine: startLine }
    }

    return {
        annotation: {
            fields,
            id: fields.id,
            tag: fields.tag,
            label: fields.label,
            start,
            end: close + 1,
            line: startLine,
            endLine: startLine,
        },
        consumed: true,
        end: close + 1,
        endLine: startLine,
    }
}

function parseAwktFields(body: string): Record<string, string> | null {
    if (body.length === 0) return null

    const fields: Record<string, string> = {}
    for (const part of body.split(/\s+/)) {
        const eq = part.indexOf('=')
        if (eq <= 0 || eq === part.length - 1) return null

        const key = part.slice(0, eq)
        const value = part.slice(eq + 1)
        if (!ANNOTATION_KEY_PATTERN.test(key)) return null

        fields[key] = value
    }

    return fields
}

/*──── helper that also tracks line number while counting parens ───*/

function findMatchingParenWithLineRecover(str: string, open: number, startLine: number) {
    let depth = 0
    let line = startLine
    const len = str.length
    let lastCommaOrSpace = open
    const allowedWords = new Set<string>([...TOP, 'EMPTY'])

    for (let j = open; j < len; j++) {
        const ch = str.charCodeAt(j)
        if (ch === CC.NL) { line++; continue }
        if (ch === 13 /* CR */) { continue } // ignore CR
        if (ch === CC.LParen) depth++
        else if (ch === CC.RParen) {
            depth--
            if (depth === 0) {
                return { endIdx: j, endLine: line, recoveredAt: j + 1 }
            }
        } else if (ch === 44 /* , */ || ch === 32 /* space */) {
            lastCommaOrSpace = j
        } else if (ch === 9 /* tab */) {
            // allow tabs for indentation
            continue
        } else if (!isAlpha(ch) && ch !== 46 /* . */ && (ch < 48 || ch > 57) && ch !== 45 /* - */) {
            // Allow other structural chars like newline already handled, semicolons or stray letters cause recovery
            return { endIdx: -1, endLine: line, recoveredAt: lastCommaOrSpace + 1 }
        } else if (isAlpha(ch)) {
            // Potential word inside geometry content
            const wordStart = j
            let k = j + 1
            while (k < len) {
                const ck = str.charCodeAt(k)
                if (!isAlpha(ck)) break
                k++
            }
            const word = str.slice(wordStart, k).toUpperCase()
            if (!allowedWords.has(word) && depth >= 1) {
                // Unexpected word inside coordinate section -> recover
                return { endIdx: -1, endLine: line, recoveredAt: k }
            }
            j = k - 1 // continue after the word
        }
    }
    return { endIdx: -1, endLine: line, recoveredAt: len }
}
