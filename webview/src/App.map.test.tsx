import * as LL from 'leaflet'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type MsgToWebview, type WktToken } from '@wkt-viewer/shared'
import App from './App'

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

const source = { uri: 'file:///points.wkt', version: 1, filename: 'points.wkt' }
const point: WktToken = { start: 0, end: 12, line: 0, endLine: 0, wkt: 'POINT(20 30)' }
const line: WktToken = { start: 20, end: 45, line: 1, endLine: 1, wkt: 'LINESTRING(0 0,100 100)' }
const svgSupport = LL.Browser.svg

beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('acquireVsCodeApi', () => ({ postMessage: vi.fn() }))
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
    HTMLElement.prototype.scrollIntoView = vi.fn()
    // jsdom does not implement SVGSVGElement.createSVGRect, which Leaflet uses for detection.
    Reflect.set(LL.Browser, 'svg', true)
})

afterEach(() => {
    Reflect.set(LL.Browser, 'svg', svgSupport)
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
})

function mountViewer() {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    act(() => root.render(<App />))
    return { host, cleanup: () => { act(() => root.unmount()); host.remove() } }
}

function update(tokens: WktToken[], fitId: number, selected = false) {
    act(() => {
        window.dispatchEvent(new MessageEvent('message', { data: {
            command: 'update', wkt: tokens, source,
            scope: selected ? { kind: 'selection', ranges: [{ start: point.start, end: point.end }] } : { kind: 'document' },
            viewLocked: selected, fitId,
        } satisfies MsgToWebview }))
        if (selected) window.dispatchEvent(new MessageEvent('message', { data: {
            command: 'select', source, ranges: [{ start: point.start, end: point.end }],
        } satisfies MsgToWebview }))
    })
    act(() => vi.advanceTimersByTime(500))
}

describe('viewer with a real Leaflet map', () => {
    it('can filter to one point, unlock and fit the document again', () => {
        const fit = vi.spyOn(LL.Map.prototype, 'fitBounds')
        const { host, cleanup } = mountViewer()
        try {
            update([point, line], 1)
            const map = fit.mock.instances[0] as LL.Map
            const previousZoom = map.getZoom()
            update([point], 2, true)
            expect(Number.isFinite(map.getZoom())).toBe(true)
            expect(map.getZoom()).toBe(previousZoom)
            expect(map.getCenter().equals([30, 20])).toBe(true)
            expect(host.querySelectorAll('[data-geom-id]')).toHaveLength(1)
            update([point, line], 3)
            expect(map.getBounds().contains([100, 100])).toBe(true)
            expect(host.querySelectorAll('[data-geom-id]')).toHaveLength(2)
        } finally { cleanup() }
    })

    it('opens directly into a locked single-point view', () => {
        const setView = vi.spyOn(LL.Map.prototype, 'setView')
        const { host, cleanup } = mountViewer()
        try {
            update([point], 1, true)
            const map = setView.mock.instances[0] as LL.Map
            expect(Number.isFinite(map.getZoom())).toBe(true)
            expect(map.getCenter().equals([30, 20])).toBe(true)
            expect(host.querySelector('.leaflet-container')).not.toBeNull()
        } finally { cleanup() }
    })

    it('fits coincident points and a zero-length line without an infinite zoom', () => {
        const setView = vi.spyOn(LL.Map.prototype, 'setView')
        const { cleanup } = mountViewer()
        try {
            update([point, { ...point, start: 20, end: 32 }, {
                ...line, start: 40, end: 64, wkt: 'LINESTRING(20 30,20 30)',
            }], 1)
            const map = setView.mock.instances[0] as LL.Map
            expect(Number.isFinite(map.getZoom())).toBe(true)
            expect(map.getCenter().equals([30, 20])).toBe(true)
        } finally { cleanup() }
    })
})
