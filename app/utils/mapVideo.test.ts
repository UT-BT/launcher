import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL, deleteMapVideo, uploadMapVideo } from './api'
import { mapVideoUrl } from './mapScreenshots'

function okJson(data: unknown) {
    return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('mapVideoUrl', () => {
    it('builds the versioned video URL from the map name', () => {
        expect(mapVideoUrl('CTF-BT-SlideV2', '2026-09-30T12:00:00+00:00'))
            .toBe(`${API_BASE_URL}/videos/CTF-BT-SlideV2.webm?v=2026-09-30T12%3A00%3A00%2B00%3A00`)
    })

    it('encodes gnarly map names', () => {
        expect(mapVideoUrl('CTF-BT+[LUN]HANGTIME!!!-V2', 3))
            .toBe(`${API_BASE_URL}/videos/CTF-BT%2B%5BLUN%5DHANGTIME!!!-V2.webm?v=3`)
    })

    it('leaves the buster off without a version', () => {
        expect(mapVideoUrl('CTF-BT-SlideV2')).toBe(`${API_BASE_URL}/videos/CTF-BT-SlideV2.webm`)
        expect(mapVideoUrl('CTF-BT-SlideV2', null)).toBe(`${API_BASE_URL}/videos/CTF-BT-SlideV2.webm`)
    })
})

describe('map video fetchers', () => {
    it('uploads the file as multipart to the map video route', async () => {
        const row = { name: 'CTF-BT+Gnarly', has_video: true, video_updated_at: '2026-09-30T12:00:00+00:00' }
        const fetchMock = vi.fn().mockResolvedValue(okJson(row))
        vi.stubGlobal('fetch', fetchMock)
        const file = new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], { type: 'video/webm' })

        const result = await uploadMapVideo('token', 'CTF-BT+Gnarly', file, 'fly.webm')

        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe(`${API_BASE_URL}/admin/maps/CTF-BT%2BGnarly/video`)
        expect(init.method).toBe('POST')
        expect(init.headers.Authorization).toBe('Bearer token')
        expect(init.body).toBeInstanceOf(FormData)
        const sent = (init.body as FormData).get('file') as File
        expect(sent.name).toBe('fly.webm')
        expect(sent.size).toBe(4)
        expect(result).toEqual(row)
    })

    it('surfaces the server message when an upload is refused', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
            JSON.stringify({ success: false, error: 'The uploaded file is not a WebM video.' }),
            { status: 422, headers: { 'Content-Type': 'application/json' } },
        )))

        await expect(uploadMapVideo('token', 'CTF-BT-SlideV2', new Blob(['x']), 'fly.webm'))
            .rejects.toMatchObject({ status: 422, message: 'The uploaded file is not a WebM video.' })
    })

    it('deletes through the map video route', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson({ name: 'CTF-BT-SlideV2', has_video: false, video_updated_at: null }))
        vi.stubGlobal('fetch', fetchMock)

        await deleteMapVideo('token', 'CTF-BT-SlideV2')

        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe(`${API_BASE_URL}/admin/maps/CTF-BT-SlideV2/video`)
        expect(init.method).toBe('DELETE')
    })
})
