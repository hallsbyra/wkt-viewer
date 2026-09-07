import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type MsgFromWebview, type MsgToWebview, type WktToken } from '@wkt-viewer/shared'
import App, { findSelectedGeomObject, wktTokensToGeomObjects } from './App'

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

const reactLeafletMock = vi.hoisted(() => ({
    mapContainerProps: [] as Array<Record<string, unknown>>,
}))

const postedMessages: MsgFromWebview[] = []
const vscodeApiMock = {
    postMessage: vi.fn((message: MsgFromWebview) => {
        postedMessages.push(message)
    }),
    getState: vi.fn(),
    setState: vi.fn(),
}

const source = { uri: 'file:///test.wkt', version: 1, filename: 'test.wkt' }
function updateMessage(wkt: WktToken[]): MsgToWebview {
    return {
        command: 'update',
        wkt,
        source,
        scope: { kind: 'document' },
        captureAvailable: false,
        fitId: 0,
    }
}

vi.stubGlobal('acquireVsCodeApi', () => vscodeApiMock)

beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn()
    postedMessages.length = 0
    vscodeApiMock.postMessage.mockClear()
    reactLeafletMock.mapContainerProps.length = 0
})

vi.mock('react-leaflet', async () => {
    const React = await vi.importActual<typeof import('react')>('react')
    return {
        MapContainer: (props: Record<string, unknown> & { children?: React.ReactNode }) => {
            reactLeafletMock.mapContainerProps.push(props)
            return React.createElement('div', null, props.children)
        },
        GeoJSON: () => null,
        Marker: () => null,
        useMap: () => ({
            fitBounds: () => undefined,
            getContainer: () => document.createElement('div'),
            panBy: () => undefined,
        }),
    }
})

describe('wktTokensToGeomObjects', () => {
    const tokens: WktToken[] = [
        { start: 0, end: 10, line: 0, endLine: 0, wkt: 'POINT(1 1)' },
        { start: 11, end: 22, line: 1, endLine: 1, wkt: 'LINESTRING(0 0,1 1)' },
        { start: 23, end: 34, line: 2, endLine: 2, wkt: 'LINESTRING EMPTY' },
        { start: 35, end: 45, line: 3, endLine: 3, wkt: 'POINT(2 2)' },
    ]
    const geomObjects = wktTokensToGeomObjects(tokens)

    it('creates one geometry per token (count + order)', () => {
        expect(geomObjects).toHaveLength(4)
        expect(geomObjects.map(g => g.feature.geometry.type)).toEqual([
            'Point', 'LineString', 'LineString', 'Point'
        ])
    })

    it('parses Point geometries', () => {
        expect(geomObjects[0].feature.geometry.type).toBe('Point')
        expect(geomObjects[3].feature.geometry.type).toBe('Point')
    })

    it('parses LineString geometry', () => {
        expect(geomObjects[1].feature.geometry.type).toBe('LineString')
        expect((geomObjects[1].feature.geometry as GeoJSON.LineString).coordinates).toEqual([[0, 0], [1, 1]])
    })

    it('parses EMPTY LineString geometry', () => {
        expect(geomObjects[2].feature.geometry.type).toBe('LineString')
        expect((geomObjects[2].feature.geometry as GeoJSON.LineString).coordinates).toEqual([])
    })

    it('keeps valid geometries before and after a C# constructor mistaken for WKT', () => {
        const invalidToken = { start: 100, end: 111, line: 5, endLine: 5, wkt: 'Point(0, 4)' }
        const result = wktTokensToGeomObjects([tokens[0], invalidToken, tokens[1]])

        expect(result.map(obj => obj.token)).toEqual([tokens[0], tokens[1]])
        expect(result.map(obj => obj.id)).toEqual([tokens[0].start, tokens[1].start])
    })

    it('returns no geometries when all candidates are invalid', () => {
        expect(wktTokensToGeomObjects([
            { start: 0, end: 11, line: 0, endLine: 0, wkt: 'Point(0, 4)' },
        ])).toEqual([])
    })

    it('preserves token annotation metadata on geometry objects', () => {
        const annotatedObjects = wktTokensToGeomObjects([{
            start: 0,
            end: 10,
            line: 0,
            endLine: 0,
            wkt: 'POINT(1 1)',
            annotation: {
                fields: {
                    id: 'stroke-001',
                    tag: 'sweep-01',
                    label: '1',
                    custom: 'value',
                },
                id: 'stroke-001',
                tag: 'sweep-01',
                label: '1',
                start: 0,
                end: 43,
                line: 0,
                endLine: 0,
            },
        }])

        expect(annotatedObjects[0].token.annotation?.fields).toEqual({
            id: 'stroke-001',
            tag: 'sweep-01',
            label: '1',
            custom: 'value',
        })
    })
})

describe('App map configuration', () => {
    it('allows negative zoom so tall CRS.Simple coordinate ranges can fit in view', () => {
        const host = document.createElement('div')
        document.body.appendChild(host)
        const root = createRoot(host)

        act(() => {
            root.render(<App />)
        })

        const latestMapContainerProps = reactLeafletMock.mapContainerProps[reactLeafletMock.mapContainerProps.length - 1]
        expect(latestMapContainerProps.minZoom).toBeLessThan(0)

        act(() => {
            root.unmount()
        })
        host.remove()
    })
})

describe('findSelectedGeomObject', () => {
    it('selects a geometry when the editor selection is on its annotation', () => {
        const geomObjects = wktTokensToGeomObjects([{
            start: 22,
            end: 32,
            line: 1,
            endLine: 1,
            wkt: 'POINT(1 1)',
            annotation: {
                fields: { id: 'stroke-001' },
                id: 'stroke-001',
                start: 0,
                end: 21,
                line: 0,
                endLine: 0,
            },
        }])

        expect(findSelectedGeomObject(geomObjects, 5, { kind: 'document' })?.token.annotation?.id).toBe('stroke-001')
    })

    it('does not select an annotation outside an active area', () => {
        const geomObjects = wktTokensToGeomObjects([{
            start: 22,
            end: 32,
            line: 1,
            endLine: 1,
            wkt: 'POINT(1 1)',
            annotation: {
                fields: { id: 'stroke-001' },
                start: 0,
                end: 21,
                line: 0,
                endLine: 0,
            },
        }])

        expect(findSelectedGeomObject(geomObjects, 5, { kind: 'area', start: 22, end: 32 })).toBeNull()
    })
})

describe('App VS Code integration', () => {
    it('displays valid WKT from a document containing a false positive', () => {
        const host = document.createElement('div')
        document.body.appendChild(host)
        const root = createRoot(host)

        try {
            act(() => {
                root.render(<App />)
            })
            act(() => {
                window.dispatchEvent(new MessageEvent('message', { data: updateMessage([
                        { start: 0, end: 31, line: 0, endLine: 0, wkt: 'POLYGON ((0 0, 10 0, 5 8, 0 0))' },
                        { start: 50, end: 61, line: 1, endLine: 1, wkt: 'Point(0, 4)' },
                        { start: 70, end: 101, line: 2, endLine: 2, wkt: 'POLYGON ((0 0, 10 0, 5 8, 0 0))' },
                    ]) }))
            })

            expect(host.querySelector('h3')?.textContent).toBe('Geometries (2)')
            expect(Array.from(host.querySelectorAll('[data-geom-id]'), row => row.getAttribute('data-geom-id'))).toEqual(['0', '70'])
        } finally {
            act(() => {
                root.unmount()
            })
            host.remove()
        }
    })

    it('notifies the extension when the webview is ready for messages', () => {
        const host = document.createElement('div')
        document.body.appendChild(host)
        const root = createRoot(host)

        act(() => {
            root.render(<App />)
        })

        expect(postedMessages).toContainEqual({ command: 'ready' })

        act(() => {
            root.unmount()
        })
        host.remove()
    })

    it('accepts an update and matching selection sent in the same event turn', () => {
        const host = document.createElement('div')
        document.body.appendChild(host)
        const root = createRoot(host)
        const wkt = [{ start: 0, end: 10, line: 0, endLine: 0, wkt: 'POINT(1 1)' }]

        try {
            act(() => {
                root.render(<App />)
            })
            act(() => {
                window.dispatchEvent(new MessageEvent('message', { data: updateMessage(wkt) }))
                window.dispatchEvent(new MessageEvent('message', { data: {
                    command: 'select', source, start: 0, end: 0, captureAvailable: true,
                } satisfies MsgToWebview }))
            })

            const row = host.querySelector<HTMLElement>('[data-geom-id="0"]')
            expect(row?.style.borderColor).toBe('rgb(2, 136, 209)')
        } finally {
            act(() => root.unmount())
            host.remove()
        }
    })
})
