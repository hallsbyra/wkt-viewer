type GeomObject = {
    wkt: string
    feature: GeoJSON.Feature
    locked?: boolean
}

export function GeomObjectsList({
    geomObjects,
    setLocked,
    selectedWkt,
    onSelect,
}: {
    geomObjects: GeomObject[]
    setLocked: (wkt: string, locked: boolean) => void
    selectedWkt?: string | null
    onSelect?: (wkt: string) => void
}) {
    return (
        <div>
            <h3 style={{ margin: '4px 0 8px 0' }}>Geometries ({geomObjects.length})</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {geomObjects.map((obj, idx) => (
                    <li key={obj.wkt}
                        style={{
                            marginBottom: 8,
                            padding: 8,
                            borderRadius: 8,
                            background: obj.wkt === selectedWkt ? '#b3e5fc' : obj.locked ? '#ffe' : '#fff',
                            boxShadow: '0 1px 3px #0001',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            cursor: 'pointer',
                            border: '2px solid', // Always have a 2px border!
                            borderColor: obj.wkt === selectedWkt ? '#0288d1' : 'transparent',
                            transition: 'border-color 0.1s',
                        }}
                        onClick={() => onSelect && onSelect(obj.wkt)}
                    >

                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500 }}>#{idx + 1}</div>
                            <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#2e7d32' }}>{obj.feature.geometry.type}</div>
                            <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', color: '#666' }}>{obj.wkt}</div>
                        </div>
                        <button
                            style={{
                                fontSize: 13,
                                padding: '2px 8px',
                                background: obj.locked ? '#ffd600' : '#eee',
                                border: 'none',
                                borderRadius: 5,
                                cursor: 'pointer'
                            }}
                            onClick={e => { e.stopPropagation(); setLocked(obj.wkt, !obj.locked) }}
                            title={obj.locked ? 'Unlock' : 'Lock'}
                        >
                            {obj.locked ? '🔒' : '🔓'}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}
