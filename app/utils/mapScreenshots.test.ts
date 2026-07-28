import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAuditLog, fetchMaps, fetchMapsCount, fetchMapsMetadata, uploadOwnMapScreenshot } from './api'
import { nextScreenshotStage, screenshotUrlFor } from './mapScreenshots'

function okJson(data: unknown) {
    return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })
}

function requestedUrl(fetchMock: ReturnType<typeof vi.fn>, call = 0): URL {
    return new URL(String(fetchMock.mock.calls[call][0]), 'https://example.invalid')
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('authored-map queries', () => {
    it('sends author_ref as an exact filter, not a name search', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson([]))
        vi.stubGlobal('fetch', fetchMock)

        await fetchMaps('token', { authorRef: '228152236587483136' })

        const url = requestedUrl(fetchMock)
        expect(url.searchParams.get('author_ref')).toBe('228152236587483136')
        expect(url.searchParams.get('author')).toBeNull()
    })

    it('counts by the same filter so the tab badge matches the table', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson({ count: 76 }))
        vi.stubGlobal('fetch', fetchMock)

        const count = await fetchMapsCount('token', { authorRef: '385522602552328214' })

        expect(requestedUrl(fetchMock).searchParams.get('author_ref')).toBe('385522602552328214')
        expect(count).toBe(76)
    })

    it('carries a full snowflake id without rounding it away', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson([]))
        vi.stubGlobal('fetch', fetchMock)

        await fetchMaps('token', { authorRef: '385522602552328214' })

        expect(requestedUrl(fetchMock).searchParams.get('author_ref')).toBe('385522602552328214')
    })
})

describe('screenshot cache busting', () => {
    it('asks for the fields every MapThumbnail needs to bust its cache', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson([]))
        vi.stubGlobal('fetch', fetchMock)

        await fetchMapsMetadata('token')

        const columns = (requestedUrl(fetchMock).searchParams.get('columns') ?? '').split(',')
        expect(columns).toContain('screenshot_updated')
        expect(columns).toContain('has_screenshot')
    })
})

describe('audit log actor scoping', () => {
    it('defaults to the staff feed so mapper uploads do not bury staff actions', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson({ items: [] }))
        vi.stubGlobal('fetch', fetchMock)

        await fetchAuditLog('token', { actors: 'staff' })

        expect(requestedUrl(fetchMock).searchParams.get('actors')).toBe('staff')
    })

    it('can widen to player actions when staff go looking for abuse', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson({ items: [] }))
        vi.stubGlobal('fetch', fetchMock)

        await fetchAuditLog('token', { actors: 'players' })

        expect(requestedUrl(fetchMock).searchParams.get('actors')).toBe('players')
    })
})

describe('mapper screenshot upload', () => {
    it('posts multipart to the self-service route with the caller bearer', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson({ name: 'CTF-BT-SlideV2', has_screenshot: true }))
        vi.stubGlobal('fetch', fetchMock)

        const result = await uploadOwnMapScreenshot('token', 'CTF-BT-SlideV2', new Blob(['x']), 'CTF-BT-SlideV2.png')

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toContain('/maps/CTF-BT-SlideV2/screenshot')
        expect(url).not.toContain('/admin/')
        expect(init.method).toBe('POST')
        expect(init.headers).toEqual({ Authorization: 'Bearer token' })
        expect(init.body).toBeInstanceOf(FormData)
        expect(result.has_screenshot).toBe(true)
    })

    it('escapes map names that contain URL punctuation', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson({ name: 'CTF-BT+D!@blo' }))
        vi.stubGlobal('fetch', fetchMock)

        await uploadOwnMapScreenshot('token', 'CTF-BT+D!@blo', new Blob(['x']), 'shot.png')

        expect(String(fetchMock.mock.calls[0][0])).toContain('/maps/CTF-BT%2BD!%40blo/screenshot')
    })

    it('surfaces the API refusal instead of resolving', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(
            JSON.stringify({ success: false, error: 'Only the author of this map can change its screenshot.' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } },
        ))
        vi.stubGlobal('fetch', fetchMock)

        await expect(uploadOwnMapScreenshot('token', 'CTF-BT-SlideV2', new Blob(['x']), 'shot.png'))
            .rejects.toThrow(/author of this map/)
    })
})

describe('screenshot urls', () => {
    it('requests the derivative that matches the rendered box', () => {
        expect(screenshotUrlFor('derived', 'CTF-BT-Cupola', 'thumb')).toContain('/screenshots/derived/96/')
        expect(screenshotUrlFor('derived', 'CTF-BT-Cupola', 'card')).toContain('/screenshots/derived/256/')
        expect(screenshotUrlFor('derived', 'CTF-BT-Cupola', 'hero')).toContain('/screenshots/derived/1024/')
    })

    it('falls back derived -> canonical -> default and then stays put', () => {
        expect(nextScreenshotStage('derived')).toBe('canonical')
        expect(nextScreenshotStage('canonical')).toBe('default')
        expect(nextScreenshotStage('default')).toBe('default')
    })

    it('keeps the canonical PNG reachable, since a derivative can be missing', () => {
        const url = screenshotUrlFor('canonical', 'CTF-BT-Cupola', 'hero')
        expect(url).toContain('/screenshots/CTF-BT-Cupola.png')
        expect(url).not.toContain('derived')
    })

    it('escapes map names with characters that are legal on disk but not in a URL', () => {
        for (const name of ['CTF-BT+[LUN]HANGTIME!!!-V2', 'CTF-BT-CM24 Winter', 'CTF-BT-#Forgotten', 'CTF-BT+D!@blo']) {
            for (const stage of ['derived', 'canonical'] as const) {
                const url = screenshotUrlFor(stage, name, 'thumb')
                const path = url.split('?')[0]
                expect(path).not.toContain(' ')
                expect(path).not.toContain('#')
                expect(decodeURIComponent(path.split('/').pop()!.replace(/\.(webp|png)$/, ''))).toBe(name)
            }
        }
    })

    it('carries the cache buster onto derivatives, not just the png', () => {
        expect(screenshotUrlFor('derived', 'CTF-BT-Cupola', 'thumb', 12345)).toContain('?v=12345')
        expect(screenshotUrlFor('canonical', 'CTF-BT-Cupola', 'thumb', 12345)).toContain('?v=12345')
        expect(screenshotUrlFor('derived', 'CTF-BT-Cupola', 'thumb')).not.toContain('?v=')
    })

    it('never busts the shared default, which is not per-map', () => {
        expect(screenshotUrlFor('default', 'CTF-BT-Cupola', 'thumb', 12345)).toMatch(/\/screenshots\/default\.png$/)
    })
})
