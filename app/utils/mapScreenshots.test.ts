import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchMaps, fetchMapsCount, uploadOwnMapScreenshot } from './api'

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
