import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    API_BASE_URL,
    ApiError,
    MAP_ARCHIVE_MAX_BYTES,
    discardMapUploadDraft,
    fetchMapUploadDraft,
    fetchMapUploadDrafts,
    mapUploadErrorMessage,
    uploadMapArchive,
    type UploadProgress,
} from './api'
import { MAP_UPLOAD_ERROR_CODES } from './mapUploadTypes'
import {
    MAP_UPLOAD_FIXTURES,
    mapUploadErrorFixture,
    mapUploadFixture,
    mapUploadFixtureResponse,
    mapUploadFixtureText,
    type MapUploadErrorFixtureName,
} from './fixtures/mapUploadFixtures'

class FakeXhr {
    static instances: FakeXhr[] = []

    method = ''
    url = ''
    headers: Record<string, string> = {}
    body: unknown = undefined
    timeout = 0
    status = 0
    responseText = ''
    upload: { onprogress: ((event: { loaded: number; total: number; lengthComputable: boolean }) => void) | null } = { onprogress: null }
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    onabort: (() => void) | null = null
    ontimeout: (() => void) | null = null

    constructor() {
        FakeXhr.instances.push(this)
    }

    open(method: string, url: string) {
        this.method = method
        this.url = url
    }

    setRequestHeader(name: string, value: string) {
        this.headers[name] = value
    }

    send(body: unknown) {
        this.body = body
    }

    abort() {
        this.onabort?.()
    }

    progress(loaded: number, total: number) {
        this.upload.onprogress?.({ loaded, total, lengthComputable: total > 0 })
    }

    respond(status: number, text: string) {
        this.status = status
        this.responseText = text
        this.onload?.()
    }
}

function lastXhr(): FakeXhr {
    const xhr = FakeXhr.instances.at(-1)
    if (!xhr) throw new Error('no request was sent')
    return xhr
}

function respondWithFixture(name: MapUploadErrorFixtureName | 'upload') {
    lastXhr().respond(MAP_UPLOAD_FIXTURES[name].status, mapUploadFixtureText(name))
}

function stubFetch(response: Response) {
    const fetchMock = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

function sentRequest(fetchMock: ReturnType<typeof vi.fn>): { url: string; init: RequestInit } {
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    return { url, init }
}

async function rejectionOf(pending: Promise<unknown>): Promise<unknown> {
    return pending.then(
        () => { throw new Error('expected a rejection') },
        (e: unknown) => e,
    )
}

const archive = new Blob(['archive bytes'])

beforeEach(() => {
    FakeXhr.instances = []
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('uploadMapArchive', () => {
    it('posts the archive as the multipart field archive with the staff bearer', async () => {
        const pending = uploadMapArchive('staff-token', archive, 'foo-and-bar.zip')

        const xhr = lastXhr()
        expect(xhr.method).toBe('POST')
        expect(xhr.url).toBe(`${API_BASE_URL}/admin/map-uploads`)
        expect(xhr.headers).toEqual({ Authorization: 'Bearer staff-token' })
        const sent = (xhr.body as FormData).get('archive') as File
        expect(sent.name).toBe('foo-and-bar.zip')
        expect(await sent.text()).toBe('archive bytes')

        respondWithFixture('upload')
        await expect(pending).resolves.toEqual(mapUploadFixture('upload'))
    })

    it('reports upload progress to the caller', async () => {
        const seen: UploadProgress[] = []
        const pending = uploadMapArchive('t', archive, 'a.zip', { onProgress: (p) => seen.push(p) })

        lastXhr().progress(100, 400)
        lastXhr().progress(400, 400)
        respondWithFixture('upload')
        await pending

        expect(seen).toEqual([{ loaded: 100, total: 400 }, { loaded: 400, total: 400 }])
    })

    it('rejects with an AbortError when the caller cancels', async () => {
        const controller = new AbortController()
        const pending = uploadMapArchive('t', archive, 'a.zip', { signal: controller.signal })

        controller.abort()
        const error = await rejectionOf(pending)

        expect(error).toBeInstanceOf(DOMException)
        expect((error as DOMException).name).toBe('AbortError')
        expect(mapUploadErrorMessage(error)).toBe('The upload was cancelled.')
    })

    it.each([
        ['errorNoMap', 'no_map', /no map/i],
        ['errorBadArchive', 'bad_archive', /could not be opened/i],
    ] as const)('maps %s to its code and a plain message', async (fixture, code, message) => {
        const pending = uploadMapArchive('t', archive, 'a.zip')
        respondWithFixture(fixture)
        const error = await rejectionOf(pending)

        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(422)
        expect((error as ApiError).reason).toBe(code)
        expect(mapUploadErrorMessage(error)).toMatch(message)
    })

    it('maps a 413 without a JSON body to the size limit', async () => {
        const pending = uploadMapArchive('t', archive, 'huge.zip')
        lastXhr().respond(413, '<html><body>413 Request Entity Too Large</body></html>')
        const error = await rejectionOf(pending)

        expect((error as ApiError).status).toBe(413)
        expect(mapUploadErrorMessage(error)).toBe('This archive is over the 200 MB upload limit.')
    })
})

describe('the draft reads', () => {
    it('lists every draft from the drafts route, newest first as sent', async () => {
        const fetchMock = stubFetch(mapUploadFixtureResponse('drafts'))

        const drafts = await fetchMapUploadDrafts('staff-token')

        const { url, init } = sentRequest(fetchMock)
        expect(url).toBe(`${API_BASE_URL}/admin/map-uploads/drafts`)
        expect(init.method).toBe('GET')
        expect(init.headers).toMatchObject({ Authorization: 'Bearer staff-token' })
        expect(drafts).toEqual(mapUploadFixture('drafts'))
        expect(drafts.map((d) => d.id)).toEqual([14, 13, 12, 9])
    })

    it('reads an empty list when the envelope has no data', async () => {
        stubFetch(new Response('{"success":true}\n', { status: 200 }))

        await expect(fetchMapUploadDrafts('t')).resolves.toEqual([])
    })

    it('reads one draft with its files, blocks and warnings', async () => {
        const fetchMock = stubFetch(mapUploadFixtureResponse('draft'))

        const draft = await fetchMapUploadDraft('t', 12)

        expect(sentRequest(fetchMock).url).toBe(`${API_BASE_URL}/admin/map-uploads/drafts/12`)
        expect(draft).toEqual(mapUploadFixture('draft'))
        expect(draft.files.map((f) => f.disposition)).toContain('dropped')
    })

    it('maps a missing draft to a plain message', async () => {
        stubFetch(new Response('{"error":"Not found","success":false}\n', { status: 404 }))

        const error = await rejectionOf(fetchMapUploadDraft('t', 99))

        expect(mapUploadErrorMessage(error)).toMatch(/no longer exists/)
    })
})

describe('discardMapUploadDraft', () => {
    it('deletes the draft and reads the confirmation', async () => {
        const fetchMock = stubFetch(mapUploadFixtureResponse('discard'))

        await expect(discardMapUploadDraft('staff-token', 13)).resolves.toEqual({ deleted: true })

        const { url, init } = sentRequest(fetchMock)
        expect(url).toBe(`${API_BASE_URL}/admin/map-uploads/drafts/13`)
        expect(init.method).toBe('DELETE')
        expect(init.headers).toMatchObject({ Authorization: 'Bearer staff-token' })
    })
})

describe('mapUploadErrorMessage', () => {
    const errorFixtures: MapUploadErrorFixtureName[] = [
        'errorNoMap',
        'errorBadArchive',
        'errorDraftInvalid',
        'errorTooEarly',
        'errorStragglersChanged',
        'errorNotDistributing',
    ]

    it.each(errorFixtures)('gives %s a plain message of its own', async (name) => {
        const fetchMock = stubFetch(mapUploadFixtureResponse(name))
        const error = await rejectionOf(fetchMapUploadDraft('t', 12))
        const body = mapUploadErrorFixture(name)

        expect(fetchMock).toHaveBeenCalledOnce()
        expect((error as ApiError).reason).toBe(body.code)
        const message = mapUploadErrorMessage(error)
        expect(message).not.toBe(body.code)
        expect(message).not.toMatch(/Request failed/)
    })

    it('has a distinct message for every error code', () => {
        const messages = MAP_UPLOAD_ERROR_CODES.map((code) => mapUploadErrorMessage(new ApiError(409, undefined, 'fallback', code)))
        expect(new Set(messages).size).toBe(MAP_UPLOAD_ERROR_CODES.length)
        expect(messages).not.toContain('fallback')
    })

    it('falls back to the error message for anything else', () => {
        expect(mapUploadErrorMessage(new ApiError(500, 'Server exploded', 'fallback'))).toBe('Server exploded')
        expect(mapUploadErrorMessage(new Error('Offline'))).toBe('Offline')
        expect(mapUploadErrorMessage('nope')).toBe('Something went wrong. Please try again.')
    })

    it('uses the 200 MB cap the client checks', () => {
        expect(MAP_ARCHIVE_MAX_BYTES).toBe(200 * 1024 * 1024)
    })
})
