import { useSyncExternalStore } from 'react'
import {
    DEVICE_QUERIES,
    deviceEnvironmentFrom,
    sameDeviceEnvironment,
    type DeviceEnvironment,
    type VisualViewportState,
} from './deviceEnvironment'

const listeners = new Set<() => void>()
let snapshot: DeviceEnvironment | null = null
let detach: (() => void) | null = null

function matches(query: string): boolean {
    return window.matchMedia(query).matches
}

function readVisualViewport(): VisualViewportState | null {
    const viewport = window.visualViewport
    if (!viewport) return null
    return {
        scale: viewport.scale,
        offsetLeft: viewport.offsetLeft,
        offsetTop: viewport.offsetTop,
        pageLeft: viewport.pageLeft,
        pageTop: viewport.pageTop,
        width: viewport.width,
        height: viewport.height,
    }
}

function readDeviceEnvironment(): DeviceEnvironment {
    return deviceEnvironmentFrom({
        touch: matches(DEVICE_QUERIES.touch),
        belowLg: matches(DEVICE_QUERIES.belowLg),
        portrait: matches(DEVICE_QUERIES.portrait),
        standaloneDisplayMode: matches(DEVICE_QUERIES.standalone),
        navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone === true,
        visualViewport: readVisualViewport(),
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
    })
}

function refresh(): DeviceEnvironment {
    const next = readDeviceEnvironment()
    if (!snapshot || !sameDeviceEnvironment(snapshot, next)) snapshot = next
    return snapshot
}

function handleChange() {
    const previous = snapshot
    if (refresh() !== previous) listeners.forEach(listener => listener())
}

function attach(): () => void {
    const queries = Object.values(DEVICE_QUERIES).map(query => window.matchMedia(query))
    const viewport = window.visualViewport
    queries.forEach(query => query.addEventListener('change', handleChange))
    viewport?.addEventListener('resize', handleChange)
    viewport?.addEventListener('scroll', handleChange)
    window.addEventListener('resize', handleChange)
    window.addEventListener('scroll', handleChange, { passive: true })
    window.addEventListener('orientationchange', handleChange)
    return () => {
        queries.forEach(query => query.removeEventListener('change', handleChange))
        viewport?.removeEventListener('resize', handleChange)
        viewport?.removeEventListener('scroll', handleChange)
        window.removeEventListener('resize', handleChange)
        window.removeEventListener('scroll', handleChange)
        window.removeEventListener('orientationchange', handleChange)
    }
}

export function getDeviceEnvironment(): DeviceEnvironment {
    return snapshot && listeners.size > 0 ? snapshot : refresh()
}

export function subscribeDeviceEnvironment(listener: () => void): () => void {
    listeners.add(listener)
    if (!detach) {
        refresh()
        detach = attach()
    }
    return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && detach) {
            detach()
            detach = null
        }
    }
}

export function useDeviceEnvironment(): DeviceEnvironment
export function useDeviceEnvironment<T>(select: (environment: DeviceEnvironment) => T): T
export function useDeviceEnvironment<T>(select?: (environment: DeviceEnvironment) => T): T | DeviceEnvironment {
    return useSyncExternalStore(
        subscribeDeviceEnvironment,
        () => select ? select(getDeviceEnvironment()) : getDeviceEnvironment(),
    )
}
