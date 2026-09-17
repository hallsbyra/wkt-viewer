import * as LL from 'leaflet'
import { describe, expect, it, vi } from 'vitest'
import { type GeomObject } from './App'
import { fitGeometry, focusGeometryIfOutsideView, getGeometryStyle } from './GeomObjectsMap'
import { COLOR, POINT_RADIUS, POINT_RADIUS_SELECTED } from './styles'

const taggedPoint: GeomObject = {
    id: 42,
    token: {
        start: 0,
        end: 10,
        line: 0,
        endLine: 0,
        wkt: 'POINT(1 2)',
        annotation: {
            fields: { tag: 'upper-tip' },
            tag: 'upper-tip',
            start: 0,
            end: 20,
            line: 0,
            endLine: 0,
        },
    },
    feature: {
        type: 'Feature',
        properties: null,
        geometry: { type: 'Point', coordinates: [1, 2] },
    },
}

describe('getGeometryStyle', () => {
    it('uses the selected colors and a larger radius even when a geometry has a tag', () => {
        expect(getGeometryStyle(taggedPoint, taggedPoint.id)).toMatchObject({
            color: COLOR.selectedStroke,
            fillColor: COLOR.selectedFill,
            radius: POINT_RADIUS_SELECTED,
        })
    })

    it('keeps the tag color and normal radius when the geometry is not selected', () => {
        const style = getGeometryStyle(taggedPoint, 99)

        expect(style.radius).toBe(POINT_RADIUS)
        expect(style.color).toBe(style.fillColor)
        expect(style.color).not.toBe(COLOR.selectedStroke)
    })
})

describe('focusGeometryIfOutsideView', () => {
    const visibleBounds = LL.latLngBounds([[0, 0], [10, 10]])

    function createMap() {
        return {
            getBounds: () => visibleBounds,
            fitBounds: vi.fn(),
            panTo: vi.fn(),
        } as unknown as LL.Map
    }

    it('fits a shape outside the current map view', () => {
        const map = createMap()

        focusGeometryIfOutsideView(map, {
            type: 'LineString',
            coordinates: [[20, 30], [40, 50]],
        })

        expect(map.fitBounds).toHaveBeenCalledOnce()
        const [bounds, options] = vi.mocked(map.fitBounds).mock.calls[0]
        expect((bounds as LL.LatLngBounds).toBBoxString()).toBe('20,30,40,50')
        expect(options).toEqual({ padding: [10, 10] })
        expect(map.panTo).not.toHaveBeenCalled()
    })

    it('keeps the map view when any part of the shape is visible', () => {
        const map = createMap()

        focusGeometryIfOutsideView(map, {
            type: 'LineString',
            coordinates: [[5, 5], [20, 20]],
        })

        expect(map.fitBounds).not.toHaveBeenCalled()
        expect(map.panTo).not.toHaveBeenCalled()
    })

    it('fits a shape even when it is already partly visible', () => {
        const map = createMap()

        fitGeometry(map, {
            type: 'LineString',
            coordinates: [[5, 5], [20, 20]],
        })

        expect(map.fitBounds).toHaveBeenCalledOnce()
    })

    it('pans to an off-screen point without trying to fit zero-size bounds', () => {
        const map = createMap()

        focusGeometryIfOutsideView(map, { type: 'Point', coordinates: [20, 30] })

        expect(map.fitBounds).not.toHaveBeenCalled()
        expect(map.panTo).toHaveBeenCalledWith(LL.latLng(30, 20))
    })
})
