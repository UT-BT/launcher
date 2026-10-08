import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    API_BASE_URL,
    ApiError,
    fetchMapUploadDrift,
    fetchMapUploadPublish,
    fetchMapUploadPublishes,
    forceActivateMapUploadPublish,
    mapUploadErrorMessage,
} from './api'
import {
    MAP_UPLOAD_FIXTURES,
    mapUploadErrorFixture,
    mapUploadFixture,
    mapUploadFixtureResponse,
    type MapUploadErrorFixtureName,
} from './fixtures/mapUploadFixtures'

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

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('fetchMapUploadPublishes', () => {
    it('lists the recent publishes, 20 by default, newest first as sent', async () => {
        const fetchMock = stubFetch(mapUploadFixtureResponse('publishes'))

        const publishes = await fetchMapUploadPublishes('staff-token')

        const { url, init } = sentRequest(fetchMock)
        expect(url).toBe(`${API_BASE_URL}/admin/map-uploads/publishes?limit=20`)
        expect(init.method).toBe('GET')
        expect(init.headers).toMatchObject({ Authorization: 'Bearer staff-token' })
        expect(publishes).toEqual(mapUploadFixture('publishes'))
        expect(publishes.map((p) => p.id)).toEqual([3, 2, 1])
        expect(publishes.map((p) => [p.hosts_confirmed, p.hosts_total])).toEqual([[1, 4], [4, 4], [0, 0]])
    })

    it('asks for another limit', async () => {
        const fetchMock = stubFetch(mapUploadFixtureResponse('publishes'))

        await fetchMapUploadPublishes('t', undefined, 50)

        expect(sentRequest(fetchMock).url).toBe(`${API_BASE_URL}/admin/map-uploads/publishes?limit=50`)
    })

    it('reads an empty list when the envelope has no data', async () => {
        stubFetch(new Response('{"success":true}\n', { status: 200 }))

        await expect(fetchMapUploadPublishes('t')).resolves.toEqual([])
    })

    it('keeps the reason of a failed publish', async () => {
        stubFetch(mapUploadFixtureResponse('publishes'))

        const failed = (await fetchMapUploadPublishes('t')).find((p) => p.state === 'failed')

        expect(failed?.error).toBe('Could not store CTF-BT-Qux.unr.')
    })
})

describe('fetchMapUploadPublish', () => {
    it('reads one publish with its hosts, version and force time', async () => {
        const fetchMock = stubFetch(mapUploadFixtureResponse('publish'))

        const publish = await fetchMapUploadPublish('staff-token', 3)

        const { url, init } = sentRequest(fetchMock)
        expect(url).toBe(`${API_BASE_URL}/admin/map-uploads/publishes/3`)
        expect(init.method).toBe('GET')
        expect(init.headers).toMatchObject({ Authorization: 'Bearer staff-token' })
        expect(publish).toEqual(mapUploadFixture('publish'))
        expect(publish.hosts.map((h) => h.state)).toEqual(['error', 'installed', 'conflict', 'pending'])
        expect(publish.version).toEqual({ mode: 'update', old_map: 'CTF-BT-Foo-v1' })
        expect(publish.force_available_at).toBe('2026-10-06T20:27:00+00:00')
    })

    it('rejects a missing publish with its status', async () => {
        stubFetch(new Response('{"error":"Not found","success":false}\n', { status: 404 }))

        const error = await rejectionOf(fetchMapUploadPublish('t', 99))

        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(404)
    })
})

describe('forceActivateMapUploadPublish', () => {
    it('posts the confirmed hosts and reads the activated publish', async () => {
        const fetchMock = stubFetch(mapUploadFixtureResponse('forceActivate'))

        const publish = await forceActivateMapUploadPublish('staff-token', 3, { confirm_hosts: ['au1', 'eu2', 'us2'] })

        const { url, init } = sentRequest(fetchMock)
        expect(url).toBe(`${API_BASE_URL}/admin/map-uploads/publishes/3/force-activate`)
        expect(init.method).toBe('POST')
        expect(init.headers).toMatchObject({ Authorization: 'Bearer staff-token', 'Content-Type': 'application/json' })
        expect(JSON.parse(init.body as string)).toEqual({ confirm_hosts: ['au1', 'eu2', 'us2'] })
        expect(publish).toEqual(mapUploadFixture('forceActivate'))
        expect(publish.state).toBe('active')
        expect(publish.activation).toBe('forced')
        expect(publish.activated_by).toEqual({ alias: 'Carol', id: '412398765432109876' })
    })

    const forceErrors: MapUploadErrorFixtureName[] = ['errorTooEarly', 'errorStragglersChanged', 'errorNotDistributing']

    it.each(forceErrors)('rejects %s with its code and a plain message', async (name) => {
        stubFetch(mapUploadFixtureResponse(name))
        const body = mapUploadErrorFixture(name)

        const error = await rejectionOf(forceActivateMapUploadPublish('t', 3, { confirm_hosts: ['us2'] }))

        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(MAP_UPLOAD_FIXTURES[name].status)
        expect((error as ApiError).status).toBe(409)
        expect((error as ApiError).reason).toBe(body.code)
        const message = mapUploadErrorMessage(error)
        expect(message).not.toBe(body.code)
        expect(message).not.toMatch(/Request failed/)
    })

    it('gives every force error its own message', async () => {
        const messages: string[] = []
        for (const name of forceErrors) {
            stubFetch(mapUploadFixtureResponse(name))
            messages.push(mapUploadErrorMessage(await rejectionOf(forceActivateMapUploadPublish('t', 3, { confirm_hosts: [] }))))
        }
        expect(new Set(messages).size).toBe(forceErrors.length)
    })
})

describe('fetchMapUploadDrift', () => {
    it('reads every differing file with its locations', async () => {
        const fetchMock = stubFetch(mapUploadFixtureResponse('drift'))

        const rows = await fetchMapUploadDrift('staff-token')

        const { url, init } = sentRequest(fetchMock)
        expect(url).toBe(`${API_BASE_URL}/admin/map-uploads/drift`)
        expect(init.method).toBe('GET')
        expect(init.headers).toMatchObject({ Authorization: 'Bearer staff-token' })
        expect(rows).toEqual(mapUploadFixture('drift'))
        expect(rows.map((r) => r.file)).toEqual(['FooTex.utx', 'OldTex.utx'])
        expect(rows[0].locations.map((l) => [l.location, l.state])).toEqual([
            ['redirect', 'present'],
            ['eu1', 'present'],
            ['eu2', 'conflict'],
        ])
    })

    it('reads an empty report when the envelope has no data', async () => {
        stubFetch(new Response('{"success":true}\n', { status: 200 }))

        await expect(fetchMapUploadDrift('t')).resolves.toEqual([])
    })
})
