import * as LL from 'leaflet'

// ---- Style & Color Constants ----

export const COLOR = {
    selectedStroke: '#0288d1',
    selectedFill: '#b3e5fc',
    defaultStroke: '#555',
    defaultFill: '#ccc',
}

export const SELECTED_PATH_STYLE: LL.PathOptions = {
    color: COLOR.selectedStroke,
    weight: 4,
    opacity: 1,
    fillColor: COLOR.selectedFill,
    fillOpacity: 0.6,
}

export const DEFAULT_PATH_STYLE: LL.PathOptions = {
    color: COLOR.defaultStroke,
    weight: 2,
    opacity: 0.8,
    fillColor: COLOR.defaultFill,
    fillOpacity: 0.25,
}

export const POINT_RADIUS = 6
export const POINT_RADIUS_SELECTED = 7
