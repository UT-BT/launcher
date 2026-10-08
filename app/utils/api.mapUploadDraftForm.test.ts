import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    API_BASE_URL,
    ApiError,
    fetchMapUploadScreenshot,
    mapUploadErrorMessage,
    patchMapUploadDraft,
    publishMapUploadDraft,
    removeMapUploadScreenshot,
    selectEmbeddedMapUploadScreenshot,
    uploadMapUploadScreenshot,
} from './api'
import {
    mapUploadErrorFixture,
    mapUploadFixture,
    mapUploadFixtureResponse,
    mapUploadFixtureText,
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

function stubFetch(response: Response) {
    const fetchMock = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

function sentRequest(fetchMock: ReturnType<typeof vi.fn>): { url: string; init: RequestInit } {
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    return { url, init }
}

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function rejectionOf(pending: Promise<unknown>): Promise<unknown> {
    return pending.then(
        () => { throw new Error('expected a rejection') },
        (e: unknown) => e,
    )
}

const notFound = { code: undefined, error: 'Draft not found', success: false }

beforeEach(() => {
    FakeXhr.instances = []
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('patchMapUploadDraft', () => {
    it('sends only the given fields as a JSON PATCH and returns the draft', async () => {
        const fetchMock = stubFetch(mapUploadFixtureResponse('draftPatch'))

        const draft = await patchMapUploadDraft('staff-token', 12, { changelog: 'Fixed the second jump.', acknowledgements: { code_package: true } })

        const { url, init } = sentRequest(fetchMock)
        expect(url).toBe(`${API_BASE_URL}/admin/map-uploads/drafts/12`)
        expect(init.method).toBe('PATCH')
        expect(init.headers).toMatchObject({ Authorization: 'Bearer staff-token', 'Content-Type': 'application/json' })
        expect(JSON.parse(init.body as string)).toEqual({ changelog: 'Fixed the second jump.', acknowledgements: { code_package: true } })
        expect(draft).toEqual(mapUploadFixture('draftPatch'))
    })

    it('maps a 404 to the missing-draft message', async () => {
        stubFetch(jsonResponse(404, notFound))

        const error = await rejectionOf(patchMapUploadDraft('staff-token', 12, { difficulty: 4 }))

        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(404)
        expect(mapUploadErrorMessage(error)).toMatch(/no longer exists/)
    })

    it('keeps the server message for a refused value', async () => {
        stubFetch(jsonResponse(400, { error: 'difficulty must be between 1 and 10', success: false }))

        const error = await rejectionOf(patchMapUploadDraft('staff-token', 12, { difficulty: 40 }))

        expect(mapUploadErrorMessage(error)).toBe('difficulty must be between 1 and 10')
    })
})

describe('uploadMapUploadScreenshot', () => {
    it('puts the image as the multipart field file and returns the draft', async () => {
        const pending = uploadMapUploadScreenshot('staff-token', 12, new Blob(['png bytes']), 'CTF-BT-Foo.png')

        const xhr = lastXhr()
        expect(xhr.method).toBe('PUT')
        expect(xhr.url).toBe(`${API_BASE_URL}/admin/map-uploads/drafts/12/screenshot`)
        expect(xhr.headers).toEqual({ Authorization: 'Bearer staff-token' })
        const sent = (xhr.body as FormData).get('file') as File
        expect(sent.name).toBe('CTF-BT-Foo.png')
        expect(await sent.text()).toBe('png bytes')
        xhr.respond(200, mapUploadFixtureText('draftScreenshotPut'))

        await expect(pending).resolves.toEqual(mapUploadFixture('draftScreenshotPut'))
    })

    it('rejects with the server message when the image is refused', async () => {
        const pending = uploadMapUploadScreenshot('staff-token', 12, new Blob(['nope']), 'CTF-BT-Foo.png')
        lastXhr().respond(400, JSON.stringify({ error: 'The image could not be read.', success: false }))

        const error = await rejectionOf(pending)

        expect(error).toBeInstanceOf(ApiError)
        expect(mapUploadErrorMessage(error)).toBe('The image could not be read.')
    })
})

describe('selectEmbeddedMapUploadScreenshot', () => {
    it('posts to the embedded route and returns the draft', async () => {
        const fetchMock = stubFetch(mapUploadFixtureResponse('draftScreenshotEmbedded'))

        const draft = await selectEmbeddedMapUploadScreenshot('staff-token', 13)

        const { url, init } = sentRequest(fetchMock)
        expect(url).toBe(`${API_BASE_URL}/admin/map-uploads/drafts/13/screenshot/embedded`)
        expect(init.method).toBe('POST')
        expect(draft).toEqual(mapUploadFixture('draftScreenshotEmbedded'))
    })

    it('rejects with the server message when the map has no embedded screenshot', async () => {
        stubFetch(jsonResponse(409, { error: 'This map has no embedded screenshot.', success: false }))

        const error = await rejectionOf(selectEmbeddedMapUploadScreenshot('staff-token', 13))

        expect((error as ApiError).status).toBe(409)
        expect(mapUploadErrorMessage(error)).toBe('This map has no embedded screenshot.')
    })
})

describe('removeMapUploadScreenshot', () => {
    it('deletes the staged screenshot and returns the draft', async () => {
        const fetchMock = stubFetch(mapUploadFixtureResponse('draftScreenshotDelete'))

        const draft = await removeMapUploadScreenshot('staff-token', 12)

        const { url, init } = sentRequest(fetchMock)
        expect(url).toBe(`${API_BASE_URL}/admin/map-uploads/drafts/12/screenshot`)
        expect(init.method).toBe('DELETE')
        expect(draft.screenshot.source).toBe('none')
        expect(draft).toEqual(mapUploadFixture('draftScreenshotDelete'))
    })

    it('maps a 404 to the missing-draft message', async () => {
        stubFetch(jsonResponse(404, notFound))

        expect(mapUploadErrorMessage(await rejectionOf(removeMapUploadScreenshot('staff-token', 12)))).toMatch(/no longer exists/)
    })
})

describe('fetchMapUploadScreenshot', () => {
    it.each(['staged', 'embedded'] as const)('reads the %s image as a blob with the staff bearer', async (source) => {
        const fetchMock = stubFetch(new Response(new Blob(['png'], { type: 'image/png' }), { status: 200, headers: { 'Content-Type': 'image/png' } }))

        const image = await fetchMapUploadScreenshot('staff-token', 12, source)

        const { url, init } = sentRequest(fetchMock)
        expect(url).toBe(`${API_BASE_URL}/admin/map-uploads/drafts/12/screenshot?source=${source}`)
        expect(init.headers).toMatchObject({ Authorization: 'Bearer staff-token' })
        expect(image).not.toBeNull()
        expect(await image?.text()).toBe('png')
    })

    it('answers null when there is no image', async () => {
        stubFetch(jsonResponse(404, { error: 'No screenshot', success: false }))

        await expect(fetchMapUploadScreenshot('staff-token', 12, 'staged')).resolves.toBeNull()
    })

    it('rejects on any other failure', async () => {
        stubFetch(jsonResponse(500, { error: 'Something broke', success: false }))

        const error = await rejectionOf(fetchMapUploadScreenshot('staff-token', 12, 'staged'))

        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(500)
    })
})

describe('publishMapUploadDraft', () => {
    it('posts to the publish route and answers the new publish id on 202', async () => {
        const fetchMock = stubFetch(new Response(mapUploadFixtureText('publishStart'), { status: 202 }))

        const result = await publishMapUploadDraft('staff-token', 12)

        const { url, init } = sentRequest(fetchMock)
        expect(url).toBe(`${API_BASE_URL}/admin/map-uploads/drafts/12/publish`)
        expect(init.method).toBe('POST')
        expect(init.headers).toMatchObject({ Authorization: 'Bearer staff-token' })
        expect(result).toEqual({ kind: 'started', publishId: mapUploadFixture('publishStart').publish_id })
    })

    it('answers the re-checked draft on 409 draft_invalid', async () => {
        stubFetch(mapUploadFixtureResponse('errorDraftInvalid'))

        const result = await publishMapUploadDraft('staff-token', 12)

        expect(result).toEqual({ kind: 'invalid', draft: mapUploadErrorFixture('errorDraftInvalid').data })
        expect(result.kind === 'invalid' && result.draft.status).toBe('invalid')
    })

    it('rejects a draft_invalid answer that carries no draft', async () => {
        const { data: _data, ...withoutDraft } = mapUploadErrorFixture('errorDraftInvalid')
        stubFetch(jsonResponse(409, withoutDraft))

        const error = await rejectionOf(publishMapUploadDraft('staff-token', 12))

        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).reason).toBe('draft_invalid')
        expect(mapUploadErrorMessage(error)).toMatch(/no longer passes its checks/)
    })

    it.each([404, 500])('rejects with an ApiError on %i', async (status) => {
        stubFetch(jsonResponse(status, { error: 'Nope', success: false }))

        const error = await rejectionOf(publishMapUploadDraft('staff-token', 12))

        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(status)
    })

    it('rejects a success answer without a publish id', async () => {
        stubFetch(jsonResponse(202, { success: true }))

        await expect(publishMapUploadDraft('staff-token', 12)).rejects.toThrow('Invalid response format from server')
    })
})
