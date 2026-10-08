import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    SCREENSHOT_ACCEPTED_TYPES,
    SCREENSHOT_MIN_SOURCE_EDGE,
    SCREENSHOT_OUTPUT_SIZE,
    deliverScreenshot,
    screenshotCropRect,
    screenshotDestinationReady,
    screenshotMaxZoom,
    screenshotTooSmall,
} from './mapScreenshotCrop'

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('screenshot crop rules', () => {
    it('keeps the accepted types, minimum edge and output size', () => {
        expect(SCREENSHOT_ACCEPTED_TYPES).toBe('image/png,image/jpeg,image/webp')
        expect(SCREENSHOT_MIN_SOURCE_EDGE).toBe(256)
        expect(SCREENSHOT_OUTPUT_SIZE).toBe(1024)
    })

    it('refuses images whose short edge is under the minimum', () => {
        expect(screenshotTooSmall(255, 1000)).toBe(true)
        expect(screenshotTooSmall(1000, 255)).toBe(true)
        expect(screenshotTooSmall(256, 256)).toBe(false)
    })

    it('caps zoom so the crop never drops below the minimum edge', () => {
        expect(screenshotMaxZoom(256)).toBe(1)
        expect(screenshotMaxZoom(200)).toBe(1)
        expect(screenshotMaxZoom(512)).toBe(2)
        expect(screenshotMaxZoom(4096)).toBe(4)
    })

    it('crops a square from the visible frame region', () => {
        const frame = 320
        const baseScale = frame / 1000
        const offset = { x: -(2000 * baseScale - frame) / 2, y: 0 }

        const rect = screenshotCropRect({ frame, baseScale, zoom: 1, offset })

        expect(rect.sourceX).toBeCloseTo(500)
        expect(rect.sourceY).toBeCloseTo(0)
        expect(rect.sourceEdge).toBeCloseTo(1000)
        expect(rect.outputEdge).toBe(1000)
    })

    it('narrows the source region as zoom grows', () => {
        const frame = 320
        const baseScale = frame / 1000
        const rect = screenshotCropRect({ frame, baseScale, zoom: 2, offset: { x: -160, y: -64 } })

        expect(rect.sourceEdge).toBe(500)
        expect(rect.sourceX).toBe(250)
        expect(rect.sourceY).toBe(100)
        expect(rect.outputEdge).toBe(500)
    })

    it('never outputs more than the output size', () => {
        const frame = 200
        const rect = screenshotCropRect({ frame, baseScale: frame / 4000, zoom: 1, offset: { x: 0, y: 0 } })

        expect(rect.sourceEdge).toBe(4000)
        expect(rect.outputEdge).toBe(SCREENSHOT_OUTPUT_SIZE)
    })
})

describe('screenshot destinations', () => {
    const image = new Blob(['png bytes'], { type: 'image/png' })

    it('hands the cropped image to the callback without touching the network', async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
        const onCropped = vi.fn().mockResolvedValue(undefined)

        await deliverScreenshot({ kind: 'callback', mapName: 'CTF-BT-Example', onCropped }, image)

        expect(onCropped).toHaveBeenCalledWith(image, 'CTF-BT-Example.png')
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('waits for the callback and surfaces its failure', async () => {
        const onCropped = vi.fn().mockRejectedValue(new Error('Staging failed.'))

        await expect(deliverScreenshot({ kind: 'callback', mapName: 'CTF-BT-Example', onCropped }, image))
            .rejects.toThrow('Staging failed.')
    })

    it('uploads to the existing map and hands back the updated map', async () => {
        const updated = { name: 'CTF-BT-Example', has_screenshot: true, screenshot_updated: '2026-10-07T00:00:00Z' }
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: updated }), {
            status: 200, headers: { 'Content-Type': 'application/json' },
        }))
        vi.stubGlobal('fetch', fetchMock)
        const onUploaded = vi.fn()

        await deliverScreenshot({ kind: 'map', mapName: 'CTF-BT-Example', accessToken: 'token', onUploaded }, image)

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toContain('/maps/CTF-BT-Example/screenshot')
        expect(init.method).toBe('POST')
        const sent = (init.body as FormData).get('file') as File
        expect(sent.name).toBe('CTF-BT-Example.png')
        expect(onUploaded).toHaveBeenCalledWith(updated)
    })

    it('needs a token only when uploading to a map', () => {
        expect(screenshotDestinationReady({ kind: 'map', mapName: 'm', onUploaded: () => {} })).toBe(false)
        expect(screenshotDestinationReady({ kind: 'map', mapName: 'm', accessToken: 't', onUploaded: () => {} })).toBe(true)
        expect(screenshotDestinationReady({ kind: 'callback', mapName: 'm', onCropped: () => {} })).toBe(true)
    })

    it('refuses to upload to a map without a token', async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)

        await expect(deliverScreenshot({ kind: 'map', mapName: 'm', onUploaded: () => {} }, image)).rejects.toThrow()
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
