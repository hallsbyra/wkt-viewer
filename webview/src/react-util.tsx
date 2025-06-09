import { useEffect, useRef } from 'react'

/**
 * Keeps a mutable ref containing the latest value. Whenever the `value` changes
 * we update the `.current` field. Inside callbacks you can always read
 * `latest.current` and be sure it is up‑to‑date.
 */
export function useLatest<T>(value: T) {
    const latestRef = useRef(value)
    useEffect(() => {
        latestRef.current = value
    }, [value])
    return latestRef
}