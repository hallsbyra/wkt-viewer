import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type MsgFromWebview, type MsgToWebview, type WktToken } from '@wkt-viewer/shared'
import App, { findSelectedGeomObject, findSelectedGeomObjects, wktTokensToGeomObjects } from './App'

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

const reactLeafletMock = vi.hoisted(() => ({
    mapContainerProps: [] as Array<Record<string, unknown>>,
    map: {
        fitBounds: vi.fn(),
        getContainer: () => document.createElement('div'),
        panBy: vi.fn(),
        panTo: vi.fn(),
        getBounds: () => ({
            contains: () => true,
            intersects: () => true,
            toBBoxString: () => '0,0,1,1',
        }),
        getZoom: () => 0,
        on: vi.fn(),
        off: vi.fn(),
    },
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
function updateMessage(wkt: WktToken[]): Extract<MsgToWebview, { command: 'update' }> {
    return {
        command: 'update',
        wkt,
        source,
        scope: { kind: 'document' },
        viewLocked: false,
        fitId: 0,
    }
}

vi.stubGlobal('acquireVsCodeApi', () => vscodeApiMock)

beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn()
    postedMessages.length = 0
    vscodeApiMock.postMessage.mockClear()
    reactLeafletMock.mapContainerProps.length = 0
    reactLeafletMock.map.fitBounds.mockClear()
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
        useMap: () => reactLeafletMock.map,
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
    it('matches every WKT in separate text selections and leaves gaps unselected', () => {
        const objects = wktTokensToGeomObjects([0, 20, 40, 60].map(start => ({ start, end: start + 10, line: 0, endLine: 0, wkt: 'POINT(1 1)' })))
        expect(findSelectedGeomObjects(objects, [{ start: 0, end: 10 }, { start: 40, end: 70 }], { kind: 'document' }).map(obj => obj.id)).toEqual([0, 40, 60])
        expect(findSelectedGeomObjects(objects, [{ start: 20, end: 20 }, { start: 40, end: 40 }], { kind: 'document' }).map(obj => obj.id)).toEqual([20, 40])
    })

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
    const multipleWkt = [0, 20, 40, 60].map(start => ({ start, end: start + 10, line: 0, endLine: 0, wkt: 'POINT(1 1)' }))

    function mountMultiple() {
        const host = document.createElement('div')
        document.body.appendChild(host)
        const root = createRoot(host)
        act(() => root.render(<App />))
        act(() => window.dispatchEvent(new MessageEvent('message', { data: updateMessage(multipleWkt) })))
        return { host, cleanup: () => { act(() => root.unmount()); host.remove() } }
    }

    function clickRow(host: HTMLElement, id: number, modifiers: MouseEventInit = {}) {
        act(() => host.querySelector(`[data-geom-id="${id}"]`)!.dispatchEvent(new MouseEvent('click', { bubbles: true, ...modifiers })))
    }

    function selectedRows(host: HTMLElement) {
        return Array.from(host.querySelectorAll('.is-selected'), row => Number(row.getAttribute('data-geom-id')))
    }

    it('keeps the sidebar usable after a map error and allows retrying or changing scope', () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        const { host, cleanup } = mountMultiple()
        try {
            const changeScope = (fitId: number) => act(() => window.dispatchEvent(new MessageEvent('message', {
                data: { ...updateMessage(multipleWkt), fitId },
            })))
            reactLeafletMock.map.panTo.mockImplementationOnce(() => { throw new Error('Map failed') })
            changeScope(1)
            expect(host.querySelector('[role="alert"]')?.textContent).toContain('Kartan kunde inte visas')
            expect(host.querySelectorAll('[data-geom-id]')).toHaveLength(4)
            clickRow(host, 0)
            expect(selectedRows(host)).toEqual([0])
            act(() => host.querySelector<HTMLButtonElement>('.map-error button')!.click())
            expect(host.querySelector('[role="alert"]')).toBeNull()
            reactLeafletMock.map.panTo.mockImplementationOnce(() => { throw new Error('Map failed again') })
            changeScope(2)
            expect(host.querySelector('[role="alert"]')).not.toBeNull()
            changeScope(3)
            expect(host.querySelector('[role="alert"]')).toBeNull()
        } finally { cleanup(); log.mockRestore() }
    })

    it('toggles list selections with Ctrl/Cmd and selects a contiguous range with Shift', () => {
        const { host, cleanup } = mountMultiple()
        try {
            clickRow(host, 0)
            clickRow(host, 40, { ctrlKey: true })
            expect(selectedRows(host)).toEqual([0, 40])
            expect(postedMessages[postedMessages.length - 1]).toEqual({ command: 'select', source, ranges: [{ start: 40, end: 50 }, { start: 0, end: 10 }] })
            clickRow(host, 0, { metaKey: true })
            expect(selectedRows(host)).toEqual([40])
            clickRow(host, 60, { shiftKey: true })
            expect(selectedRows(host)).toEqual([0, 20, 40, 60])
            clickRow(host, 20)
            expect(selectedRows(host)).toEqual([20])
            clickRow(host, 20, { ctrlKey: true })
            expect(selectedRows(host)).toEqual([])
            expect(postedMessages[postedMessages.length - 1]).toEqual({ command: 'select', source, ranges: [] })
        } finally { cleanup() }
    })

    it('reflects multiple editor selections, locks a subset and restores the preceding view with the padlock', () => {
        const { host, cleanup } = mountMultiple()
        const ranges = [{ start: 0, end: 10 }, { start: 40, end: 70 }]
        try {
            act(() => window.dispatchEvent(new MessageEvent('message', { data: { command: 'select', source, ranges } satisfies MsgToWebview })))
            expect(selectedRows(host)).toEqual([0, 40, 60])
            expect(host.querySelectorAll('[data-geom-id]')).toHaveLength(4)
            act(() => host.querySelector<HTMLButtonElement>('.lock-button')!.click())
            expect(postedMessages[postedMessages.length - 1]).toEqual({ command: 'setSelectionLocked', locked: true, source,
                ranges: [{ start: 0, end: 10 }, { start: 40, end: 50 }, { start: 60, end: 70 }],
            })
            act(() => window.dispatchEvent(new MessageEvent('message', { data: {
                ...updateMessage(multipleWkt.filter(token => token.start !== 20)), scope: { kind: 'selection', ranges }, viewLocked: true,
            } satisfies MsgToWebview })))
            expect(host.querySelectorAll('[data-geom-id]')).toHaveLength(3)
            expect(selectedRows(host)).toEqual([0, 40, 60])
            const lockButton = host.querySelector<HTMLButtonElement>('.lock-button')!
            expect(lockButton.getAttribute('aria-pressed')).toBe('true')
            expect(lockButton.title).toBe('Lås upp och visa föregående vy')
            expect(host.querySelector('.scope-status')?.textContent).toBe('Visar 3 markerade')
            expect(host.querySelector('.selection-filter-button')).toBeNull()
            clickRow(host, 40)
            expect(host.querySelectorAll('[data-geom-id]')).toHaveLength(3)
            expect(host.querySelector('.scope-status')?.textContent).toBe('Visar 3 markerade')
            expect(postedMessages[postedMessages.length - 1].command).toBe('select')
            act(() => lockButton.click())
            expect(postedMessages[postedMessages.length - 1]).toEqual({ command: 'setSelectionLocked', locked: false, source })
            act(() => window.dispatchEvent(new MessageEvent('message', { data: updateMessage(multipleWkt) })))
            expect(host.querySelectorAll('[data-geom-id]')).toHaveLength(4)
            expect(host.querySelector('.lock-button')?.getAttribute('aria-pressed')).toBe('false')
            expect(selectedRows(host)).toEqual([40])
        } finally { cleanup() }
    })

    it('supports keyboard multiselection without treating a zoom button keypress as row selection', () => {
        const { host, cleanup } = mountMultiple()
        try {
            act(() => host.querySelector('[data-geom-id="0"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
            act(() => host.querySelector('[data-geom-id="40"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', ctrlKey: true, bubbles: true })))
            expect(selectedRows(host)).toEqual([0, 40])
            expect(host.querySelector('[role="listbox"]')?.getAttribute('aria-multiselectable')).toBe('true')
            expect(host.querySelector('[data-geom-id="40"]')?.getAttribute('aria-selected')).toBe('true')
            act(() => host.querySelector('[data-geom-id="20"] .geometry-fit-button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
            expect(selectedRows(host)).toEqual([0, 40])
        } finally { cleanup() }
    })

    it('includes cursor geometries alongside nonempty editor selections when filtering', () => {
        const { host, cleanup } = mountMultiple()
        try {
            act(() => window.dispatchEvent(new MessageEvent('message', { data: {
                command: 'select', source, ranges: [{ start: 0, end: 10 }, { start: 42, end: 42 }, { start: 15, end: 15 }],
            } satisfies MsgToWebview })))
            expect(selectedRows(host)).toEqual([0, 40])
            act(() => host.querySelector<HTMLButtonElement>('.lock-button')!.click())
            expect(postedMessages[postedMessages.length - 1]).toEqual({
                command: 'setSelectionLocked', locked: true, source, ranges: [{ start: 0, end: 10 }, { start: 40, end: 50 }],
            })
        } finally { cleanup() }
    })

    it('keeps the primary editor selection as the focused row when it is later in the document', () => {
        const { host, cleanup } = mountMultiple()
        try {
            vi.mocked(HTMLElement.prototype.scrollIntoView).mockClear()
            act(() => window.dispatchEvent(new MessageEvent('message', { data: {
                command: 'select', source, ranges: [{ start: 40, end: 50 }, { start: 0, end: 10 }],
            } satisfies MsgToWebview })))
            expect(selectedRows(host)).toEqual([0, 40])
            const calls = vi.mocked(HTMLElement.prototype.scrollIntoView).mock.instances
            const focusedRow = calls[calls.length - 1] as HTMLElement
            expect(focusedRow.getAttribute('data-geom-id')).toBe('40')
        } finally { cleanup() }
    })

    it('ignores stale editor selections and recomputes the selection after a text edit', () => {
        const { host, cleanup } = mountMultiple()
        try {
            clickRow(host, 0)
            act(() => window.dispatchEvent(new MessageEvent('message', { data: {
                command: 'select', source: { ...source, version: 0 }, ranges: [{ start: 40, end: 50 }],
            } satisfies MsgToWebview })))
            expect(selectedRows(host)).toEqual([0])
            const nextSource = { ...source, version: 2 }
            act(() => {
                window.dispatchEvent(new MessageEvent('message', { data: { ...updateMessage(multipleWkt.map(token => ({ ...token, start: token.start + 5, end: token.end + 5 }))), source: nextSource } }))
                window.dispatchEvent(new MessageEvent('message', { data: { command: 'select', source: nextSource, ranges: [{ start: 5, end: 15 }, { start: 45, end: 55 }] } satisfies MsgToWebview }))
            })
            expect(selectedRows(host)).toEqual([5, 45])
        } finally { cleanup() }
    })

    it('enables the padlock only for a marked geometry, including a partial text selection', () => {
        const { host, cleanup } = mountMultiple()
        try {
            const lockButton = host.querySelector<HTMLButtonElement>('.lock-button')!
            expect(lockButton.disabled).toBe(true)
            expect(lockButton.title).toBe('Visa och lås till markerade')
            expect(lockButton.getAttribute('aria-pressed')).toBe('false')
            act(() => lockButton.click())
            expect(postedMessages).toEqual([{ command: 'ready' }])
            act(() => window.dispatchEvent(new MessageEvent('message', { data: {
                command: 'select', source, ranges: [{ start: 12, end: 15 }],
            } satisfies MsgToWebview })))
            expect(lockButton.disabled).toBe(true)
            act(() => window.dispatchEvent(new MessageEvent('message', { data: {
                command: 'select', source, ranges: [{ start: 42, end: 43 }],
            } satisfies MsgToWebview })))
            expect(selectedRows(host)).toEqual([40])
            expect(lockButton.disabled).toBe(false)
            expect(host.querySelectorAll('[data-geom-id]')).toHaveLength(4)
            act(() => lockButton.click())
            expect(postedMessages).toEqual([
                { command: 'ready' },
                { command: 'setSelectionLocked', locked: true, ranges: [{ start: 40, end: 50 }], source },
            ])
        } finally { cleanup() }
    })

    it('still offers unlocking when no geometries remain in a locked view', () => {
        const { host, cleanup } = mountMultiple()
        try {
            act(() => window.dispatchEvent(new MessageEvent('message', { data: {
                ...updateMessage([]), scope: { kind: 'selection', ranges: [{ start: 0, end: 0 }] }, viewLocked: true,
            } satisfies MsgToWebview })))
            const lockButton = host.querySelector<HTMLButtonElement>('.lock-button')!
            expect(lockButton.disabled).toBe(false)
            expect(host.querySelector('.scope-status')?.textContent).toBe('Visar 0 markerade')
            act(() => lockButton.click())
            expect(postedMessages[postedMessages.length - 1]).toEqual({ command: 'setSelectionLocked', locked: false, source })
        } finally { cleanup() }
    })

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

            expect(host.querySelector('h3')?.textContent).toBe('Geometrier (2)')
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

    it('keeps the selected geometry when the same document updates', () => {
        const host = document.createElement('div')
        document.body.appendChild(host)
        const root = createRoot(host)
        const wkt = [{ start: 0, end: 10, line: 0, endLine: 0, wkt: 'POINT(1 1)' }]

        try {
            act(() => root.render(<App />))
            act(() => {
                window.dispatchEvent(new MessageEvent('message', { data: updateMessage(wkt) }))
                window.dispatchEvent(new MessageEvent('message', { data: {
                    command: 'select', source, ranges: [{ start: 0, end: 0 }],
                } satisfies MsgToWebview }))
            })
            expect(host.querySelector('[data-geom-id="0"]')?.classList.contains('is-selected')).toBe(true)

            act(() => {
                window.dispatchEvent(new MessageEvent('message', { data: {
                    ...updateMessage(wkt),
                    scope: { kind: 'area', start: 0, end: 10 },
                    areaLineRange: { start: 1, end: 1 },
                } satisfies MsgToWebview }))
            })
            expect(host.querySelector('[data-geom-id="0"]')?.classList.contains('is-selected')).toBe(true)
        } finally {
            act(() => root.unmount())
            host.remove()
        }
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
                    command: 'select', source, ranges: [{ start: 0, end: 0 }],
                } satisfies MsgToWebview }))
            })

            const row = host.querySelector<HTMLElement>('[data-geom-id="0"]')
            expect(row?.classList.contains('is-selected')).toBe(true)
        } finally {
            act(() => root.unmount())
            host.remove()
        }
    })

    it('does not reuse an explicit list zoom for a later single click', () => {
        const host = document.createElement('div')
        document.body.appendChild(host)
        const root = createRoot(host)
        const wkt = [
            { start: 0, end: 21, line: 0, endLine: 0, wkt: 'LINESTRING(1 1,2 2)' },
            { start: 22, end: 43, line: 1, endLine: 1, wkt: 'LINESTRING(3 3,4 4)' },
        ]

        try {
            act(() => root.render(<App />))
            act(() => window.dispatchEvent(new MessageEvent('message', { data: updateMessage(wkt) })))
            reactLeafletMock.map.fitBounds.mockClear()

            const firstRow = host.querySelector<HTMLElement>('[data-geom-id="0"]')!
            const firstFitButton = firstRow.querySelector<HTMLButtonElement>('.geometry-fit-button')!
            act(() => firstFitButton.click())
            expect(reactLeafletMock.map.fitBounds).toHaveBeenCalledOnce()
            reactLeafletMock.map.fitBounds.mockClear()

            const secondRow = host.querySelector<HTMLElement>('[data-geom-id="22"]')!
            act(() => secondRow.click())
            expect(reactLeafletMock.map.fitBounds).not.toHaveBeenCalled()
        } finally {
            act(() => root.unmount())
            host.remove()
        }
    })
})
