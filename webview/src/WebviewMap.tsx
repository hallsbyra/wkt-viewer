// src/WebviewMap.jsx
import { useEffect, useRef } from 'react'
import * as ol from 'ol'
import 'ol/ol.css'
import WKT from 'ol/format/WKT'
import { Vector } from 'ol/source'
import { Vector as VectorLayer } from 'ol/layer'
import { isEmpty } from 'ol/extent'
import Fill from 'ol/style/Fill'
import Stroke from 'ol/style/Stroke'
import Style from 'ol/style/Style'

// Acquire the VS Code API once

// const vscode = acquireVsCodeApi()

export default function WebviewMap() {


    const mapElement = useRef(null)
    const mapRef = useRef<ol.Map>(null)

    useEffect(() => {
        console.log('Initializing map...')
        // Initialize vector source + layer
        const vectorSource = new Vector()
        const vectorLayer = new VectorLayer({
            source: vectorSource,
            style: new Style({
                stroke: new Stroke({
                    color: 'blue',
                    width: 2,
                }),
                fill: new Fill({
                    color: 'rgba(0, 0, 255, 0.2)',
                }),
            }),
        })

        mapRef.current = new ol.Map({
            target: mapElement.current!,
            layers: [vectorLayer],
            view: new ol.View({
                center: [0, 0],
                zoom: 2,
            })
        })

        // Message handler
        const onMessage = (event: MessageEvent) => {
            console.log('Received message from extension:', event.data)

            const msg = event.data
            if (msg.command === 'update') {
                const map = mapRef.current
                if (!map) {
                    console.error('Map reference is null')
                    return
                }
                try {
                    const wktArr = msg.wkt as string[]
                    vectorSource.clear()
                    const features = wktArr
                        .map((wktStr, i) => {
                            try {
                                const feature = new WKT().readFeature(wktStr)
                                console.log(`Parsed feature ${i}:`, feature.getGeometry())
                                return feature
                            } catch {
                                console.warn(`Invalid WKT at ${i}:`, wktStr)
                                return null
                            }
                        })
                        .filter(f => f != null)
                    if (features.length === 0) {
                        throw new Error('No valid geometries')
                    }
                    vectorSource.addFeatures(features)

                    // fit view
                    const extent = vectorSource.getExtent()
                    if (!isEmpty(extent)) {
                        console.log('Fitting map to extent:', extent)
                        map.getView().fit(extent, { padding: [10, 10, 10, 10] })
                    } else {
                        map.getView().setCenter([0, 0])
                        map.getView().setZoom(2)
                    }
                } catch (err) {
                    console.error(err)
                    // vscode.postMessage({ command: 'error', message: err.message })
                }
            }
        }

        console.log('Adding message listener')
        window.addEventListener('message', onMessage)

        return () => {
            window.removeEventListener('message', onMessage)
            mapRef.current!.dispose()
            mapRef.current = null
        }
    }, [])

    return (
        <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
            <div
                ref={mapElement}
                style={{ height: '100%', width: '100%' }}
            />
        </div>
    )
}

