import { Component, type ReactNode } from 'react'

/** Keep the list and scope controls usable if Leaflet fails to render. */
export class MapErrorBoundary extends Component<{ fitId: number, children: ReactNode }, { failed: boolean }> {
    state = { failed: false }

    static getDerivedStateFromError() {
        return { failed: true }
    }

    componentDidUpdate(previousProps: Readonly<{ fitId: number, children: ReactNode }>) {
        if (this.state.failed && previousProps.fitId !== this.props.fitId) {
            this.setState({ failed: false })
        }
    }

    render() {
        if (!this.state.failed) return this.props.children

        return (
            <div className="map-error" role="alert">
                <p>Kartan kunde inte visas. Försök igen eller ändra urvalet.</p>
                <button type="button" onClick={() => this.setState({ failed: false })}>Försök igen</button>
            </div>
        )
    }
}
