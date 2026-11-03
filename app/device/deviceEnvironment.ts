export const LG_BREAKPOINT_PX = 1024

export const DEVICE_QUERIES = {
    touch: '(hover: none)',
    belowLg: `(max-width: ${LG_BREAKPOINT_PX - 1}px)`,
    portrait: '(orientation: portrait)',
    standalone: '(display-mode: standalone)',
} as const

export type Orientation = 'portrait' | 'landscape'

export interface VisualViewportState {
    scale: number
    offsetLeft: number
    offsetTop: number
    pageLeft: number
    pageTop: number
    width: number
    height: number
}

export interface DeviceEnvironment {
    touch: boolean
    belowLg: boolean
    orientation: Orientation
    standalone: boolean
    viewport: VisualViewportState
}

export interface DeviceProbe {
    touch: boolean
    belowLg: boolean
    portrait: boolean
    standaloneDisplayMode: boolean
    navigatorStandalone: boolean
    visualViewport: VisualViewportState | null
    innerWidth: number
    innerHeight: number
}

export function deviceEnvironmentFrom(probe: DeviceProbe): DeviceEnvironment {
    return {
        touch: probe.touch,
        belowLg: probe.belowLg,
        orientation: probe.portrait ? 'portrait' : 'landscape',
        standalone: probe.standaloneDisplayMode || probe.navigatorStandalone,
        viewport: probe.visualViewport ?? {
            scale: 1,
            offsetLeft: 0,
            offsetTop: 0,
            pageLeft: 0,
            pageTop: 0,
            width: probe.innerWidth,
            height: probe.innerHeight,
        },
    }
}

function sameViewport(a: VisualViewportState, b: VisualViewportState): boolean {
    return a.scale === b.scale
        && a.offsetLeft === b.offsetLeft
        && a.offsetTop === b.offsetTop
        && a.pageLeft === b.pageLeft
        && a.pageTop === b.pageTop
        && a.width === b.width
        && a.height === b.height
}

export function sameDeviceEnvironment(a: DeviceEnvironment, b: DeviceEnvironment): boolean {
    return a.touch === b.touch
        && a.belowLg === b.belowLg
        && a.orientation === b.orientation
        && a.standalone === b.standalone
        && sameViewport(a.viewport, b.viewport)
}
