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
