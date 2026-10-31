import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthConfig } from './config'

type CallbackRequest = { url: string; headers: { host: string } }
type CallbackResponse = { writeHead: () => void; end: () => void }
type CallbackHandler = (req: CallbackRequest, res: CallbackResponse) => Promise<void>

const userData = vi.hoisted(() => ({ path: '' }))
const callbackServer = vi.hoisted(() => ({ handler: undefined as CallbackHandler | undefined }))

vi.mock('electron', () => ({
  app: { getPath: () => userData.path },
  safeStorage: { isEncryptionAvailable: () => false },
  BrowserWindow: { getAllWindows: () => [] },
  shell: { openExternal: vi.fn() },
}))

vi.mock('http', () => ({
  createServer: (handler: CallbackHandler) => {
    callbackServer.handler = handler
    return {
      listen: (_port: number, _host: string, ready: () => void) => ready(),
      on: () => undefined,
      close: () => undefined,
    }
  },
}))

vi.mock('./logging-service', () => ({ loggingService: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const NOW = 1_900_000_000_000

function tokenResponse(accessToken: string, refreshToken: string) {
  return new Response(JSON.stringify({ access_token: accessToken, refresh_token: refreshToken, expires_in: 604800 }))
}

function discordStub(tokens: Response) {
  return vi.fn(async (url: string) => {
    if (url === 'https://discord.com/api/oauth2/token') return tokens
    if (url === 'https://discord.com/api/users/@me') {
      return new Response(JSON.stringify({ id: '123456789012345678', username: 'runner', avatar: 'a1b2' }))
    }
    throw new Error(`unexpected request to ${url}`)
  })
}

function openCallback(code: string) {
  if (!callbackServer.handler) throw new Error('login did not start its callback server')
  return callbackServer.handler(
    { url: `/callback?code=${code}`, headers: { host: '127.0.0.1:54321' } },
    { writeHead: () => undefined, end: () => undefined }
  )
}

function writtenConfig() {
  const file = join(userData.path, 'config', 'config.json')
  return existsSync(file) ? readFileSync(file, 'utf-8') : ''
}

async function freshModules() {
  vi.resetModules()
  const config = await import('./config')
  const { authService } = await import('./auth-service')
  return { config, authService }
}

const expiringSession: AuthConfig = {
  discordId: '123456789012345678',
  username: 'runner',
  avatar: 'a1b2',
  accessToken: 'old-access-token',
  refreshToken: 'old-refresh-token',
  expiresAt: NOW + 60_000,
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  callbackServer.handler = undefined
  userData.path = mkdtempSync(join(tmpdir(), 'utbt-auth-'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  rmSync(userData.path, { recursive: true, force: true })
})

describe('desktop sign-in without encryption', () => {
  it('keeps the new tokens for the session and writes none to the config file', async () => {
    vi.stubGlobal('fetch', discordStub(tokenResponse('new-access-token', 'new-refresh-token')))
    const { config, authService } = await freshModules()

    const signingIn = authService.login()
    await openCallback('discord-code')
    const profile = await signingIn

    expect(profile).toMatchObject({
      discordId: '123456789012345678',
      accessToken: 'new-access-token',
      refreshToken: '',
    })
    expect(writtenConfig()).not.toContain('new-access-token')
    expect(writtenConfig()).not.toContain('new-refresh-token')
    expect(config.getAuthConfig()).toMatchObject({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' })
    expect(await authService.getProfile()).toMatchObject({ accessToken: 'new-access-token', refreshToken: '' })
  })

  it('keeps a refreshed token in the session only', async () => {
    vi.stubGlobal('fetch', discordStub(tokenResponse('refreshed-access-token', 'rotated-refresh-token')))
    const { config, authService } = await freshModules()
    config.setAuthConfig(expiringSession)

    const profile = await authService.getProfile()

    expect(profile).toMatchObject({ accessToken: 'refreshed-access-token', refreshToken: '' })
    expect(writtenConfig()).not.toContain('refreshed-access-token')
    expect(writtenConfig()).not.toContain('rotated-refresh-token')
    expect(config.getAuthConfig()).toMatchObject({ refreshToken: 'rotated-refresh-token' })
  })

  it('ends the session on sign-out', async () => {
    const { config, authService } = await freshModules()
    config.setAuthConfig({ ...expiringSession, expiresAt: NOW + 3_600_000 })

    await authService.logout()

    expect(await authService.getProfile()).toBeUndefined()
  })
})

describe('forced refresh', () => {
  const validSession: AuthConfig = { ...expiringSession, expiresAt: NOW + 3_600_000 }

  it('returns the new access token and keeps the rotated sign-in', async () => {
    vi.stubGlobal('fetch', discordStub(tokenResponse('refreshed-access-token', 'rotated-refresh-token')))
    const { config, authService } = await freshModules()
    config.setAuthConfig(validSession)

    expect(await authService.refreshNow()).toBe('refreshed-access-token')
    expect(config.getAuthConfig()).toMatchObject({
      accessToken: 'refreshed-access-token',
      refreshToken: 'rotated-refresh-token',
    })
  })

  it('returns null instead of the stale token when the refresh fails, and keeps the sign-in', async () => {
    const fetch = discordStub(new Response('{}', { status: 401, statusText: 'Unauthorized' }))
    vi.stubGlobal('fetch', fetch)
    const { config, authService } = await freshModules()
    config.setAuthConfig(validSession)

    expect(await authService.refreshNow()).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(config.getAuthConfig()).toMatchObject({ accessToken: 'old-access-token', refreshToken: 'old-refresh-token' })
  })

  it('returns null without calling Discord when nobody is signed in', async () => {
    const fetch = discordStub(tokenResponse('refreshed-access-token', 'rotated-refresh-token'))
    vi.stubGlobal('fetch', fetch)
    const { authService } = await freshModules()

    expect(await authService.refreshNow()).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shares a refresh already in flight, so the refresh token is spent once', async () => {
    const fetch = discordStub(tokenResponse('refreshed-access-token', 'rotated-refresh-token'))
    vi.stubGlobal('fetch', fetch)
    const { config, authService } = await freshModules()
    config.setAuthConfig(expiringSession)

    const [profile, forced] = await Promise.all([authService.getProfile(), authService.refreshNow()])

    expect(profile).toMatchObject({ accessToken: 'refreshed-access-token' })
    expect(forced).toBe('refreshed-access-token')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
