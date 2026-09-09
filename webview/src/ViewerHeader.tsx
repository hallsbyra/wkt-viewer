import { type SourceDocument, type ViewingCommand, type ViewingScope } from '@wkt-viewer/shared'

export function ViewerHeader({ source, scope, areaLocked, areaLineRange, onCommand }: {
    source: SourceDocument | null
    scope: ViewingScope
    areaLocked: boolean
    areaLineRange?: { start: number, end: number }
    onCommand: (command: ViewingCommand) => void
}) {
    const areaActive = scope.kind === 'area'
    const scopeStatus = areaActive && areaLineRange
        ? `Rader ${areaLineRange.start}–${areaLineRange.end}`
        : 'Hela dokumentet'

    return (
        <header className="viewer-header">
            <div className="source-toolbar">
                <span className="source-filename" title={source?.filename}>
                    {source?.filename ?? 'Inget dokument'}
                </span>
                {areaActive && areaLineRange
                    ? <button
                        className="scope-status scope-status-button"
                        aria-label={`Markera ${scopeStatus.toLowerCase()} i editorn`}
                        title="Markera området i editorn"
                        onClick={() => onCommand({ command: 'selectArea' })}
                    >
                        {scopeStatus}
                    </button>
                    : <span className="scope-status">{scopeStatus}</span>}
                {areaActive && (
                    <button
                        className="icon-button lock-button"
                        aria-label="Lås område"
                        aria-pressed={areaLocked}
                        title={areaLocked ? 'Lås upp området' : 'Lås området så att textmarkeringar inte ändrar det'}
                        onClick={() => onCommand({ command: 'setAreaLocked', locked: !areaLocked })}
                    >
                        <HeaderIcon name={areaLocked ? 'locked' : 'unlocked'} />
                    </button>
                )}
                <button
                    className="icon-button"
                    aria-label="Zooma till alla geometrier"
                    title="Zooma till alla geometrier i vyn"
                    disabled={!source}
                    onClick={() => onCommand({ command: 'fitAll' })}
                >
                    <HeaderIcon name="fit" />
                </button>
            </div>
        </header>
    )
}

function HeaderIcon({ name }: { name: 'fit' | 'locked' | 'unlocked' }) {
    const paths = {
        fit: 'M6 2H2v4m8-4h4v4m0 4v4h-4m-4 0H2v-4M6 8h4M8 6v4',
        locked: 'M4.5 7V5a3.5 3.5 0 0 1 7 0v2M3 7h10v7H3ZM8 10v1.5',
        unlocked: 'M4.5 7V5a3.5 3.5 0 0 1 6.5-1.8M3 7h10v7H3ZM8 10v1.5',
    }
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d={paths[name]} />
        </svg>
    )
}
