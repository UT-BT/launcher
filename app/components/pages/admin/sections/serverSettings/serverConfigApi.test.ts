import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL, ApiError } from '@/app/utils/api'
import { ROLE } from '@/app/utils/roles'
import {
  serverConfigErrorFixture,
  serverConfigFixture,
  serverConfigFixtureResponse,
  serverConfigPatchFixture,
  type ServerConfigErrorFixtureName,
} from '@/app/utils/fixtures/serverConfigFixtures'
import { fetchServerConfig, saveServerConfig, serverConfigFieldErrors } from './serverConfigApi'

const SERVER_ID = '7c3e9d14-2a5b-4f68-8e01-3b9c4d5e6f01'

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function sentRequest(fetchMock: ReturnType<typeof vi.fn>): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  return { url, init }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchServerConfig', () => {
  it.each(['serverConfigResponse', 'serverConfigResponseLegacy', 'serverConfigResponseUnmanaged'] as const)(
    'reads %s',
    async (name) => {
      const fetchMock = stubFetch(serverConfigFixtureResponse(name))

      await expect(fetchServerConfig('staff-token', SERVER_ID)).resolves.toEqual(serverConfigFixture(name))

      const { url, init } = sentRequest(fetchMock)
      expect(url).toBe(`${API_BASE_URL}/admin/servers/${SERVER_ID}/config`)
      expect(init.method).toBe('GET')
      expect(init.headers).toMatchObject({ Authorization: 'Bearer staff-token' })
    },
  )
})

describe('saveServerConfig', () => {
  const body = { changes: { max_players: 14 }, apply: 'when_empty' as const }

  it('patches the full route for an admin', async () => {
    const fetchMock = stubFetch(serverConfigFixtureResponse('serverConfigPatchOk'))

    await saveServerConfig('admin-token', SERVER_ID, body, ROLE.ADMIN)

    const { url, init } = sentRequest(fetchMock)
    expect(url).toBe(`${API_BASE_URL}/admin/servers/${SERVER_ID}/config`)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual(body)
  })

  it('patches the basic route for a moderator', async () => {
    const fetchMock = stubFetch(serverConfigFixtureResponse('serverConfigPatchOk'))

    await saveServerConfig('mod-token', SERVER_ID, { changes: { ruleset: 'casual' }, reason: 'Event over' }, ROLE.MODERATOR)

    expect(sentRequest(fetchMock).url).toBe(`${API_BASE_URL}/admin/servers/${SERVER_ID}/config/basic`)
  })

  it.each(['serverConfigPatchOk', 'serverConfigPatchNextMap'] as const)('returns the result of %s', async (name) => {
    stubFetch(serverConfigFixtureResponse(name))

    await expect(saveServerConfig('t', SERVER_ID, body, ROLE.ADMIN)).resolves.toEqual({
      ok: true,
      result: serverConfigPatchFixture(name),
    })
  })

  it.each([
    ['serverConfigPatchUnknownKey', 'unknown_key', ['foo']],
    ['serverConfigPatchInvalidValue', 'invalid_value', ['max_players']],
    ['serverConfigPatchForbiddenKey', 'forbidden_key', ['max_players']],
    ['serverConfigPatchNotManaged', 'not_managed', ['motd_1']],
    ['serverConfigPatchAfterCutover', 'after_cutover', ['sudden_death']],
    ['serverConfigPatchLockedKey', 'locked_key', ['allow_boosted_caps']],
  ] as const)('maps %s to %s with its keys', async (name, code, keys) => {
    stubFetch(serverConfigFixtureResponse(name))

    await expect(saveServerConfig('t', SERVER_ID, body, ROLE.ADMIN)).resolves.toEqual({
      ok: false,
      failure: { code, message: serverConfigErrorFixture(name).error, keys },
    })
  })

  it.each([
    ['serverConfigPatchReasonRequired', 'reason_required'],
    ['serverConfigPatchNoChanges', 'no_changes'],
  ] as const)('maps %s to %s', async (name, code) => {
    stubFetch(serverConfigFixtureResponse(name))

    await expect(saveServerConfig('t', SERVER_ID, body, ROLE.ADMIN)).resolves.toEqual({
      ok: false,
      failure: { code, message: serverConfigErrorFixture(name).error },
    })
  })

  it('throws an ApiError for a failure outside the contract', async () => {
    stubFetch(new Response(JSON.stringify({ success: false, error: 'Not found' }), { status: 404 }))

    await expect(saveServerConfig('t', SERVER_ID, body, ROLE.ADMIN)).rejects.toBeInstanceOf(ApiError)
  })

  it('throws an ApiError when a keys error arrives without its keys', async () => {
    stubFetch(new Response(JSON.stringify({ success: false, error: 'x', code: 'locked_key' }), { status: 409 }))

    await expect(saveServerConfig('t', SERVER_ID, body, ROLE.ADMIN)).rejects.toBeInstanceOf(ApiError)
  })
})

describe('serverConfigFieldErrors', () => {
  async function failureOf(name: ServerConfigErrorFixtureName) {
    stubFetch(serverConfigFixtureResponse(name))
    const outcome = await saveServerConfig('t', SERVER_ID, { changes: {} }, ROLE.ADMIN)
    if (outcome.ok) throw new Error('expected a failure')
    return outcome.failure
  }

  it.each([
    ['serverConfigPatchInvalidValue', { max_players: 'The server does not accept this value' }],
    ['serverConfigPatchForbiddenKey', { max_players: 'Only admins can change this' }],
    ['serverConfigPatchNotManaged', { motd_1: 'Not managed yet' }],
    ['serverConfigPatchAfterCutover', { sudden_death: 'Available after cutover' }],
    ['serverConfigPatchLockedKey', { allow_boosted_caps: 'Set by certified' }],
  ] as const)('marks the fields named by %s', async (name, fields) => {
    expect(serverConfigFieldErrors(await failureOf(name))).toEqual(fields)
  })

  it.each(['serverConfigPatchUnknownKey', 'serverConfigPatchReasonRequired', 'serverConfigPatchNoChanges'] as const)(
    'marks no field for %s',
    async (name) => {
      expect(serverConfigFieldErrors(await failureOf(name))).toEqual({})
    },
  )
})
