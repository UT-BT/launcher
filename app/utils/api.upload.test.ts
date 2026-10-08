import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL, ApiError, apiGet, apiUpload, type UploadProgress } from './api'

type Listener = () => void

class FakeXhr {
    static instances: FakeXhr[] = []

    method = ''
    url = ''
    headers: Record<string, string> = {}
    body: unknown = undefined
    timeout = 0
    status = 0
    responseText = ''
    aborted = false
    upload: { onprogress: ((event: { loaded: number; total: number; lengthComputable: boolean }) => void) | null } = { onprogress: null }
    onload: Listener | null = null
    onerror: Listener | null = null
    onabort: Listener | null = null
    ontimeout: Listener | null = null

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
        this.aborted = true
        this.onabort?.()
    }

    progress(loaded: number, total: number) {
        this.upload.onprogress?.({ loaded, total, lengthComputable: total > 0 })
    }

    respond(status: number, body: unknown) {
        this.status = status
        this.responseText = typeof body === 'string' ? body : JSON.stringify(body)
        this.onload?.()
    }

    failNetwork() {
        this.onerror?.()
    }

    expire() {
        this.ontimeout?.()
    }
}

function lastXhr(): FakeXhr {
    const xhr = FakeXhr.instances.at(-1)
    if (!xhr) throw new Error('no request was sent')
    return xhr
}

function formWith(name: string): FormData {
    const form = new FormData()
    form.append('file', new Blob(['archive bytes']), name)
    return form
}

beforeEach(() => {
    FakeXhr.instances = []
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('apiUpload transport', () => {
    it('posts the form to the API with the caller bearer', async () => {
        const form = formWith('CTF-BT-Example.zip')
        const pending = apiUpload<{ id: string }>('/upload/probe', form, { token: 'real-token' })

        const xhr = lastXhr()
        expect(xhr.method).toBe('POST')
        expect(xhr.url).toBe(`${API_BASE_URL}/upload/probe`)
        expect(xhr.headers).toEqual({ Authorization: 'Bearer real-token' })
        expect(xhr.body).toBe(form)

        xhr.respond(201, { success: true, data: { id: 'd1' } })
        await expect(pending).resolves.toEqual({ id: 'd1' })
    })

    it('sends no Authorization header without a token', async () => {
        const pending = apiUpload('/upload/probe', formWith('a.zip'))
        const xhr = lastXhr()
        expect(xhr.headers).not.toHaveProperty('Authorization')
        xhr.respond(200, { success: true, data: {} })
        await pending
    })

    it('honours an explicit method and absolute URL', async () => {
        const pending = apiUpload('https://example.invalid/put-here', formWith('a.zip'), { method: 'PUT' })
        const xhr = lastXhr()
        expect(xhr.method).toBe('PUT')
        expect(xhr.url).toBe('https://example.invalid/put-here')
        xhr.respond(200, { success: true, data: {} })
        await pending
    })

    it('has no timeout unless the caller sets one', async () => {
        const pending = apiUpload('/upload/probe', formWith('a.zip'))
        expect(lastXhr().timeout).toBe(0)
        lastXhr().respond(200, { success: true, data: {} })
        await pending

        const timed = apiUpload('/upload/probe', formWith('a.zip'), { timeoutMs: 5_000 })
        expect(lastXhr().timeout).toBe(5_000)
        lastXhr().respond(200, { success: true, data: {} })
        await timed
    })
})

describe('apiUpload progress', () => {
    it('reports loaded and total with increasing values', async () => {
        const seen: UploadProgress[] = []
        const pending = apiUpload('/upload/probe', formWith('a.zip'), { onProgress: p => seen.push(p) })

        const xhr = lastXhr()
        xhr.progress(0, 1000)
        xhr.progress(250, 1000)
        xhr.progress(250, 1000)
        xhr.progress(100, 1000)
        xhr.progress(1000, 1000)
        xhr.respond(200, { success: true, data: {} })
        await pending

        expect(seen).toEqual([
            { loaded: 0, total: 1000 },
            { loaded: 250, total: 1000 },
            { loaded: 1000, total: 1000 },
        ])
    })

    it('reports a zero total when the size is not computable', async () => {
        const seen: UploadProgress[] = []
        const pending = apiUpload('/upload/probe', formWith('a.zip'), { onProgress: p => seen.push(p) })

        lastXhr().upload.onprogress?.({ loaded: 512, total: 0, lengthComputable: false })
        lastXhr().respond(200, { success: true, data: {} })
        await pending

        expect(seen).toEqual([{ loaded: 512, total: 0 }])
    })
})

describe('apiUpload envelope', () => {
    it('unwraps the data of a successful envelope', async () => {
        const pending = apiUpload<{ drafts: string[] }>('/upload/probe', formWith('a.zip'))
        lastXhr().respond(200, { success: true, data: { drafts: ['d1', 'd2'] } })
        await expect(pending).resolves.toEqual({ drafts: ['d1', 'd2'] })
    })

    it.each([
        ['an envelope without data', { success: true }],
        ['an envelope that is not successful', { success: false, data: {} }],
        ['a body that is not JSON', '<html>ok</html>'],
    ])('rejects %s on a 2xx answer', async (_label, body) => {
        const pending = apiUpload('/upload/probe', formWith('a.zip'))
        lastXhr().respond(200, body)
        await expect(pending).rejects.toThrow('Invalid response format from server')
    })
})

describe('apiUpload errors match apiErrorFor', () => {
    async function viaFetch(status: number, body: unknown): Promise<ApiError> {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
            typeof body === 'string' ? body : JSON.stringify(body),
            { status, headers: { 'Content-Type': 'application/json' } },
        )))
        return apiGet('/probe').then(
            () => { throw new Error('expected a rejection') },
            (e: ApiError) => e,
        )
    }

    async function viaUpload(status: number, body: unknown): Promise<ApiError> {
        const pending = apiUpload('/upload/probe', formWith('a.zip'))
        lastXhr().respond(status, body)
        return pending.then(
            () => { throw new Error('expected a rejection') },
            (e: ApiError) => e,
        )
    }

    it.each([
        ['an error message', 400, { success: false, error: 'That archive is empty.' }],
        ['a rate-limit reason', 429, { success: false, reason: 'Too many requests' }],
        ['an error with a code', 409, { success: false, error: 'A draft already exists.', code: 'draft_exists' }],
        ['a body without a message', 500, { success: false }],
        ['a body that is not JSON', 502, '<html>Bad Gateway</html>'],
        ['an empty body', 413, ''],
    ])('maps %s the same way', async (_label, status, body) => {
        const expected = await viaFetch(status, body)
        const actual = await viaUpload(status, body)

        expect(actual).toBeInstanceOf(ApiError)
        expect(actual.name).toBe(expected.name)
        expect(actual.status).toBe(expected.status)
        expect(actual.message).toBe(expected.message)
        expect(actual.reason).toBe(expected.reason)
    })

    it('keeps the server message and code on the error', async () => {
        const error = await viaUpload(409, { success: false, error: 'A draft already exists.', code: 'draft_exists' })
        expect(error.status).toBe(409)
        expect(error.message).toBe('A draft already exists.')
        expect(error.reason).toBe('draft_exists')
    })

    it('falls back to the status when the body has no message', async () => {
        const error = await viaUpload(500, '')
        expect(error.message).toBe('Request failed (500)')
    })
})

describe('apiUpload failures the UI can show', () => {
    it('rejects a network failure with a readable message', async () => {
        const pending = apiUpload('/upload/probe', formWith('a.zip'))
        lastXhr().failNetwork()
        const error = await pending.catch((e: unknown) => e)
        expect(error).toBeInstanceOf(Error)
        expect(error).not.toBeInstanceOf(ApiError)
        expect((error as Error).message).toMatch(/could not reach the server/i)
    })

    it('aborts the request when the signal fires and rejects with an AbortError', async () => {
        const controller = new AbortController()
        const pending = apiUpload('/upload/probe', formWith('a.zip'), { signal: controller.signal })
        const xhr = lastXhr()

        controller.abort()

        const error = await pending.catch((e: unknown) => e)
        expect(xhr.aborted).toBe(true)
        expect((error as Error).name).toBe('AbortError')
        expect((error as Error).message).toMatch(/cancelled/i)
    })

    it('never sends when the signal is already aborted', async () => {
        const controller = new AbortController()
        controller.abort()

        const error = await apiUpload('/upload/probe', formWith('a.zip'), { signal: controller.signal }).catch((e: unknown) => e)

        expect(FakeXhr.instances).toHaveLength(0)
        expect((error as Error).name).toBe('AbortError')
    })

    it('rejects a timeout with a TimeoutError', async () => {
        const pending = apiUpload('/upload/probe', formWith('a.zip'), { timeoutMs: 1_000 })
        lastXhr().expire()
        const error = await pending.catch((e: unknown) => e)
        expect((error as Error).name).toBe('TimeoutError')
        expect((error as Error).message).toMatch(/timed out/i)
    })

    it('stops listening to the signal once the upload settles', async () => {
        const controller = new AbortController()
        const pending = apiUpload('/upload/probe', formWith('a.zip'), { signal: controller.signal })
        const xhr = lastXhr()
        xhr.respond(200, { success: true, data: {} })
        await pending

        controller.abort()

        expect(xhr.aborted).toBe(false)
    })
})
