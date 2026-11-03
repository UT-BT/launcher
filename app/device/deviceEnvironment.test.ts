import { describe, expect, it } from 'vitest'
import { deviceEnvironmentFrom, sameDeviceEnvironment, type DeviceProbe } from './deviceEnvironment'

const VIEWPORT = { scale: 1, offsetLeft: 0, offsetTop: 0, pageLeft: 0, pageTop: 0, width: 390, height: 664 }

const PHONE: DeviceProbe = {
    touch: true,
    belowLg: true,
    portrait: true,
    standaloneDisplayMode: false,
    navigatorStandalone: false,
    visualViewport: VIEWPORT,
    innerWidth: 390,
    innerHeight: 664,
}

describe('deviceEnvironmentFrom', () => {
    it('reports a portrait phone in the browser', () => {
        expect(deviceEnvironmentFrom(PHONE)).toEqual({
            touch: true,
            belowLg: true,
            orientation: 'portrait',
            standalone: false,
            viewport: { scale: 1, offsetLeft: 0, offsetTop: 0, pageLeft: 0, pageTop: 0, width: 390, height: 664 },
        })
    })

    it('reports landscape when the portrait query does not match', () => {
        expect(deviceEnvironmentFrom({ ...PHONE, portrait: false }).orientation).toBe('landscape')
    })

    it('treats either the standalone display mode or the iOS home screen flag as standalone', () => {
        expect(deviceEnvironmentFrom({ ...PHONE, standaloneDisplayMode: true }).standalone).toBe(true)
        expect(deviceEnvironmentFrom({ ...PHONE, navigatorStandalone: true }).standalone).toBe(true)
    })

    it('falls back to the window size at scale 1 without a visualViewport', () => {
        expect(deviceEnvironmentFrom({ ...PHONE, visualViewport: null, innerWidth: 1280, innerHeight: 720 }).viewport)
            .toEqual({ scale: 1, offsetLeft: 0, offsetTop: 0, pageLeft: 0, pageTop: 0, width: 1280, height: 720 })
    })
})

describe('sameDeviceEnvironment', () => {
    const base = deviceEnvironmentFrom(PHONE)

    it('is true for equal readings', () => {
        expect(sameDeviceEnvironment(base, deviceEnvironmentFrom({ ...PHONE }))).toBe(true)
    })

    it('notices a pinch zoom', () => {
        const zoomed = deviceEnvironmentFrom({ ...PHONE, visualViewport: { ...VIEWPORT, scale: 2, offsetTop: 120 } })
        expect(sameDeviceEnvironment(base, zoomed)).toBe(false)
    })

    it('notices a rotation', () => {
        expect(sameDeviceEnvironment(base, deviceEnvironmentFrom({ ...PHONE, portrait: false }))).toBe(false)
    })
})
