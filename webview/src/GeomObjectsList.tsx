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
    const listContainerRef = useRef<HTMLUListElement  | null>(null)
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
        <div>
            <h3 style={{ margin: '4px 0 8px 0' }}>Geometries ({geomObjects.length})</h3>
            <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search id, tag, label"
                style={{
                    boxSizing: 'border-box',
                    width: '100%',
                    marginBottom: 8,
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: '1px solid #ddd',
                    fontSize: 13,
                }}
            />
            <ul 
                ref={listContainerRef}
                style={{ listStyle: 'none', padding: 0, margin: 0 }}
            >
                {filteredGeomObjects.map((obj) => {
                    const originalIndex = geomObjects.indexOf(obj)
                    const annotation = obj.token.annotation
                    const tagColor = getTagColor(annotation?.tag)
                    const title = annotation ? getAnnotationTitle(annotation) : undefined

                    return (
                        <li key={obj.id}
                            style={{
                                marginBottom: 8,
                                padding: 8,
                                borderRadius: 8,
                                background: obj.id === selectedId ? '#b3e5fc' : '#fff',
                                boxShadow: '0 1px 3px #0001',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                cursor: 'pointer',
                                border: '2px solid', // Always have a 2px border!
                                borderColor: obj.id === selectedId ? '#0288d1' : 'transparent',
                                transition: 'border-color 0.1s',
                            }}
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
                                    <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#444', wordBreak: 'break-all' }}>
                                        {annotation.id}
                                    </div>
                                )}
                                {annotation?.tag && (
                                    <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#555', wordBreak: 'break-all' }}>
                                        {annotation.tag}
                                    </div>
                                )}
                                <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#2e7d32' }}>{obj.feature.geometry.type}</div>
                                <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', color: '#666' }}>{obj.token.wkt}</div>
                            </div>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
