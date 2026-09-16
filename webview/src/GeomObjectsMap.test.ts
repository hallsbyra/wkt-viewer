import { describe, expect, it } from 'vitest'
import { type GeomObject } from './App'
import { getGeometryStyle } from './GeomObjectsMap'
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
