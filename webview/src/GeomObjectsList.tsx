import { GeomObject } from './App'

export function GeomObjectsList({
    geomObjects,
    selectedId,
    onSelect,
}: {
    geomObjects: GeomObject[]
    selectedId?: number | null
    onSelect?: (obj: GeomObject) => void
}) {
    return (
        <div>
            <h3 style={{ margin: '4px 0 8px 0' }}>Geometries ({geomObjects.length})</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {geomObjects.map((obj, idx) => (
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
                        onClick={() => onSelect && onSelect(obj)}
                    >

                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500 }}>#{idx + 1}</div>
                            <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#2e7d32' }}>{obj.feature.geometry.type}</div>
                            <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', color: '#666' }}>{obj.token.wkt}</div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    )
}
