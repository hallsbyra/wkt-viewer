/**
 * Extracts all top-level WKT (Well-Known Text) snippets from an input string.
 * Supports nested geometries (e.g., GEOMETRYCOLLECTION) but does not return inner components.
 * Handles EMPTY geometries.
 * Does not use any third-party libraries and runs in O(n) time.
 *
 * @param input - The string containing one or more WKT snippets.
 * @returns An array of objects: { wkt, start, end } for each parsed WKT.
 */
/*
export function extractWkt(input: string, maxTokens: number = Infinity): WktToken[] {
    const results: WktToken[]  = []
    const wktTypes = [
        'GEOMETRYCOLLECTION',
        'MULTIPOLYGON',
        'MULTILINESTRING',
        'MULTIPOINT',
        'POLYGON',
        'LINESTRING',
        'POINT'
    ]
    const inputUpper = input.toUpperCase()
    const len = input.length
    let pos = 0

    while (pos < len && results.length < maxTokens) {
        let nearest: { type: string, index: number } | null = null
        for (const type of wktTypes) {
            const idx = inputUpper.indexOf(type, pos)
            if (idx !== -1 && (nearest === null || idx < nearest.index)) {
                nearest = { type, index: idx }
            }
        }
        if (!nearest) { break }

        const { type, index: startIdx } = nearest
        let i = startIdx + type.length

        // Skip whitespace
        while (i < len && /\s/.test(input[i])) { i++ }

        // Handle EMPTY geometries
        if (inputUpper.substr(i, 5) === 'EMPTY') {
            results.push({ wkt: input.slice(startIdx, i + 5), start: startIdx, end: i + 5 })
            pos = i + 5
            continue
        }

        // Expect opening parenthesis
        if (input[i] === '(') {
            let depth = 0
            let j = i
            while (j < len) {
                if (input[j] === '(') { depth++ }
                else if (input[j] === ')') {
                    depth--
                    if (depth === 0) {
                        results.push({ wkt: input.slice(startIdx, j + 1), start: startIdx, end: j + 1 })
                        pos = j + 1
                        break
                    }
                }
                j++
            }
            if (j >= len) {
                // Unmatched parentheses; abort
                break
            }
        } else {
            // Not a valid snippet; move forward to avoid infinite loop
            pos = i
        }
    }

    return results
}
*/

export type WktToken = {
    wkt: string          // The WKT substring
    start: number         // Start offset (0-based)
    end: number         // End offset   (0-based, exclusive)
    line: number         // 0-based line number where the WKT starts
    endLine: number      // 0-based line where it ends  (optional)
}

/*──────────────────────────── helpers ────────────────────────────*/

const enum CC {
    A = 65, Z = 90, a = 97, z = 122,
    LParen = 40, RParen = 41, NL = 10,
}

const TOP = [
    'POINT', 'LINESTRING', 'POLYGON',
    'MULTIPOINT', 'MULTILINESTRING', 'MULTIPOLYGON',
    'GEOMETRYCOLLECTION',
] as const
type TOPKW = (typeof TOP)[number]

/** fast ASCII alpha check */
const isAlpha = (c: number) =>
    (c >= CC.A && c <= CC.Z) || (c >= CC.a && c <= CC.z)

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

        if (!TOP.includes(word as TOPKW)) continue         // not a WKT keyword

        /* ---- skip whitespace (tracking newlines) ---- */
        while (i < len && /\s/.test(input[i])) {
            if (input.charCodeAt(i) === CC.NL) line++
            i++
        }

        /* ---- handle EMPTY (no parentheses) ---- */
        if (upper.startsWith('EMPTY', i)) {
            const end = i + 5
            out.push({
                wkt: input.slice(wordStart, end),
                start: wordStart, end,
                line: startLine,
                endLine: line
            })
            i = end
            continue
        }

        /* ---- expect '(' and walk to matching ')' ---- */
        if (input.charCodeAt(i) !== CC.LParen) continue   // malformed

        const { endIdx, endLine } = findMatchingParenWithLine(input, i, line)
        if (endIdx === -1) break                          // unmatched → abort

        out.push({
            wkt: input.slice(wordStart, endIdx + 1),
            start: wordStart, end: endIdx + 1,
            line: startLine,
            endLine
        })

        i = endIdx + 1
        line = endLine
    }

    return out
}

/*──── helper that also tracks line number while counting parens ───*/

function findMatchingParenWithLine(str: string, open: number, startLine: number) {
    let depth = 0
    let line = startLine
    const len = str.length

    for (let j = open; j < len; j++) {
        const ch = str.charCodeAt(j)
        if (ch === CC.NL) line++

        if (ch === CC.LParen) depth++
        else if (ch === CC.RParen) {
            depth--
            if (depth === 0) {
                return { endIdx: j, endLine: line }
            }
        }
    }
    return { endIdx: -1, endLine: line }   // unmatched
}
