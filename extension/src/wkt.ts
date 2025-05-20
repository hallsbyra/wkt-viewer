/**
 * Extracts all top-level WKT (Well-Known Text) snippets from an input string.
 * Supports nested geometries (e.g., GEOMETRYCOLLECTION) but does not return inner components.
 * Handles EMPTY geometries.
 * Does not use any third-party libraries and runs in O(n) time.
 *
 * @param input - The string containing one or more WKT snippets.
 * @returns An array of extracted top-level WKT strings.
 */
export function extractWkt(input: string): string[] {
    const results: string[] = []
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

    while (pos < len) {
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
            results.push(input.slice(startIdx, i + 5))
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
                        results.push(input.slice(startIdx, j + 1))
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
