import { type SourceDocument, type ViewingScope } from '@wkt-viewer/shared'

type HeaderCommand = 'captureArea' | 'showDocument' | 'fitAll'

export function ViewerHeader({ source, scope, captureAvailable, areaLineRange, onCommand }: {
    source: SourceDocument | null
    scope: ViewingScope
    captureAvailable: boolean
    areaLineRange?: { start: number, end: number }
    onCommand: (command: HeaderCommand) => void
}) {
    const areaActive = scope.kind === 'area'
    const captureTitle = !captureAvailable
        ? 'Markera text i dokumentet för att välja ett område'
        : areaActive
            ? 'Ersätt aktuellt område med den nya textmarkeringen'
            : 'Visa endast WKT i textmarkeringen'

    return (
        <header className="viewer-header">
            <div className="source-toolbar">
                <span className="source-filename" title={source?.filename}>
                    {source?.filename ?? 'Inget dokument'}
                </span>
                {areaActive && areaLineRange && (
                    <span className="area-lines">Rader {areaLineRange.start}–{areaLineRange.end}</span>
                )}
                <button
                    className="icon-button"
                    aria-label="Visa alla i bild"
                    title="Visa alla geometrier i aktuellt område eller dokument"
                    disabled={!source}
                    onClick={() => onCommand('fitAll')}
                >
                    <HeaderIcon name="fit" />
                </button>
            </div>
            <div className="scope-controls" role="group" aria-label="Visningsområde">
                <button
                    aria-pressed={!areaActive}
                    disabled={!source}
                    title="Visa WKT i hela dokumentet"
                    onClick={() => onCommand('showDocument')}
                >
                    <HeaderIcon name="document" />
                    Hela dokumentet
                </button>
                <button
                    aria-pressed={areaActive}
                    aria-describedby="scope-hint"
                    disabled={!source || !captureAvailable}
                    title={captureTitle}
                    onClick={() => onCommand('captureArea')}
                >
                    <HeaderIcon name={areaActive ? 'refresh' : 'area'} />
                    Aktuellt område
                </button>
            </div>
            <p id="scope-hint" className="scope-hint">
                {areaActive
                    ? 'Markera ny text och klicka på Aktuellt område för att byta.'
                    : 'Markera text för att visa ett avgränsat område.'}
            </p>
        </header>
    )
}

function HeaderIcon({ name }: { name: 'document' | 'area' | 'refresh' | 'fit' }) {
    const paths = {
        document: 'M9.5 1.5h-6v13h9V4.5l-3-3Zm0 0v3h3M5.5 7.5h5m-5 3h5',
        area: 'M5.5 2.5h-3v3m8-3h3v3m0 5v3h-3m-5 0h-3v-3M6 6h4v4H6Z',
        refresh: 'M13 6a5.2 5.2 0 0 0-9-1L2 7m0-4v4h4m-3 3a5.2 5.2 0 0 0 9 1l2-2m0 4V9h-4',
        fit: 'M6 2H2v4m8-4h4v4m0 4v4h-4m-4 0H2v-4M6 8h4M8 6v4',
    }
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d={paths[name]} />
        </svg>
    )
}
