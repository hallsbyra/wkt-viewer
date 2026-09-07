import { useEffect, useRef, useState } from 'react'
import { GeomObject } from './App'
import { getAnnotationTitle, getTagColor, matchesAnnotationQuery } from './annotation'

export function GeomObjectsList({
    geomObjects,
    selectedId,
    onSelect,
}: {
    geomObjects: GeomObject[]
    selectedId?: number | null
    onSelect?: (obj: GeomObject) => void
}) {
    const listContainerRef = useRef<HTMLUListElement | null>(null)
    const [query, setQuery] = useState('')
    const normalizedQuery = query.trim().toLowerCase()
    const filteredGeomObjects = geomObjects.filter(obj => matchesAnnotationQuery(obj.token.annotation, normalizedQuery))
    
    /* -------- Scroll the selected list item into view -------- */
    useEffect(() => {
        if (selectedId == null) return
        // Each list row must have data-geom-id={id}
        const row = listContainerRef.current?.querySelector<HTMLElement>(`[data-geom-id="${selectedId}"]`)
        row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, [selectedId])

    return (
        <div className="geometry-list">
            <h3>Geometrier ({geomObjects.length})</h3>
            <input
                className="geometry-search"
                aria-label="Sök id, tagg eller etikett"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Sök id, tagg eller etikett"
            />
            <ul 
                ref={listContainerRef}
                style={{ listStyle: 'none', padding: 0, margin: 0, overflowY: 'auto', minHeight: 0, flex: 1 }}
            >
                {filteredGeomObjects.map((obj) => {
                    const originalIndex = geomObjects.indexOf(obj)
                    const annotation = obj.token.annotation
                    const tagColor = getTagColor(annotation?.tag)
                    const title = annotation ? getAnnotationTitle(annotation) : undefined

                    return (
                        <li key={obj.id}
                            className={`geometry-row${obj.id === selectedId ? ' is-selected' : ''}`}
                            // So that we can find this element and scroll it into view
                            data-geom-id={obj.id}
                            title={title}
                            onClick={() => onSelect && onSelect(obj)}
                        >

                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                    {tagColor && (
                                        <span
                                            aria-hidden="true"
                                            style={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: 2,
                                                background: tagColor,
                                                flex: '0 0 auto',
                                            }}
                                        />
                                    )}
                                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {annotation?.label ?? annotation?.id ?? `#${originalIndex + 1}`}
                                    </div>
                                </div>
                                {annotation?.id && (
                                    <div className="geometry-details" style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                                        {annotation.id}
                                    </div>
                                )}
                                {annotation?.tag && (
                                    <div className="geometry-details" style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                                        {annotation.tag}
                                    </div>
                                )}
                                <div className="geometry-type" style={{ fontFamily: 'monospace', fontSize: 13 }}>{obj.feature.geometry.type}</div>
                                <div className="geometry-details" style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{obj.token.wkt}</div>
                            </div>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
