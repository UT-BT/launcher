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
