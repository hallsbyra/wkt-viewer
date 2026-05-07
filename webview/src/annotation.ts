import { type WktAnnotation } from '@wkt-viewer/shared'

const KNOWN_ANNOTATION_KEYS = new Set(['id', 'tag', 'label'])
const TAG_COLORS = [
    '#4E79A7',
    '#F28E2B',
    '#59A14F',
    '#E15759',
    '#76B7B2',
    '#EDC948',
    '#B07AA1',
    '#FF9DA7',
    '#9C755F',
    '#BAB0AC',
]

export function getAnnotationEntries(annotation: WktAnnotation): Array<[string, string]> {
    const entries: Array<[string, string]> = []
    if (annotation.id) entries.push(['id', annotation.id])
    if (annotation.tag) entries.push(['tag', annotation.tag])
    if (annotation.label) entries.push(['label', annotation.label])

    for (const [key, value] of Object.entries(annotation.fields)) {
        if (!KNOWN_ANNOTATION_KEYS.has(key)) {
            entries.push([key, value])
        }
    }

    return entries
}

export function getAnnotationTitle(annotation: WktAnnotation): string {
    return getAnnotationEntries(annotation)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n')
}

export function getTagColor(tag: string | undefined): string | undefined {
    if (!tag) return undefined

    let hash = 0
    for (let i = 0; i < tag.length; i++) {
        hash = ((hash << 5) - hash + tag.charCodeAt(i)) | 0
    }

    return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

export function matchesAnnotationQuery(annotation: WktAnnotation | undefined, query: string): boolean {
    if (!query) return true
    if (!annotation) return false

    const normalizedQuery = query.toLowerCase()
    return getAnnotationEntries(annotation)
        .some(([key, value]) =>
            key.toLowerCase().includes(normalizedQuery)
            || value.toLowerCase().includes(normalizedQuery))
}
