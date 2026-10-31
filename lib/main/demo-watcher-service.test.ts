import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthConfig } from './config'
import type { DemoWatcherService } from './demo-watcher-service'

const dirs = vi.hoisted(() => ({ userData: '', app: '' }))

vi.mock('electron', () => ({
  app: { getPath: () => dirs.userData, getAppPath: () => dirs.app, isPackaged: false },
  safeStorage: { isEncryptionAvailable: () => false },
  BrowserWindow: { getAllWindows: () => [] },
  shell: { openExternal: vi.fn() },
}))

vi.mock('chokidar', () => {
  const watcher = { on: () => watcher, close: async () => undefined }
  return { default: { watch: () => watcher } }
})

vi.mock('child_process', () => ({
  execFile: (_file: string, _args: string[], done: (error: null, output: { stdout: string }) => void) =>
    done(null, { stdout: 'BTPOG:run-1\nBTPOG:run-1\n' }),
}))

vi.mock('./gateway-service', () => ({
  gatewayService: {
    get: async (endpoint: string) =>
      endpoint.startsWith('/caps?')
        ? { success: true, data: [{ cap_type: 2, team_run_id: null }] }
        : { success: true, data: [] },
  },
}))

vi.mock('./logging-service', () => ({
  loggingService: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const NOW = 1_900_000_000_000
const DEMO = 'CTF-BT-Example__00m_42s_123ms__2030-03-17-12h00m_Run1.dem'

type WatcherState = {
  jobs: Array<{ filename: string }>
  completed: Array<{ status: string }>
}

type Network = {
  refresh: () => Response
  upload: (accessToken: string) => Response
}

const signedIn: AuthConfig = {
  discordId: '123456789012345678',
  username: 'runner',
  avatar: 'a1b2',
  accessToken: 'old-access-token',
  refreshToken: 'old-refresh-token',
  expiresAt: NOW + 3_600_000,
}

const expired: AuthConfig = { ...signedIn, expiresAt: NOW - 60_000 }

let root = ''
let watcher: DemoWatcherService | undefined

function refreshed() {
  return new Response(
    JSON.stringify({ access_token: 'fresh-access-token', refresh_token: 'rotated-refresh-token', expires_in: 604800 })
  )
}

function refreshRefused() {
  return new Response('{}', { status: 400, statusText: 'Bad Request' })
}

function uploaded() {
  return new Response(JSON.stringify({ success: true, message: 'Demo uploaded successfully' }))
}

function unauthorised() {
  return new Response(JSON.stringify({ success: false, reason: 'Invalid authentication' }), { status: 401 })
}

function capNotFoundYet() {
  return new Response(JSON.stringify({ success: false, reason: 'No matching cap found for this demo' }), {
    status: 404,
  })
}

function acceptsOnly(accessToken: string) {
  return (sent: string) => (sent === accessToken ? uploaded() : unauthorised())
}

function stubNetwork(network: Network) {
  const calls = { refreshes: 0, uploadTokens: [] as string[] }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === 'https://discord.com/api/oauth2/token') {
        calls.refreshes++
        return network.refresh()
      }
      if (url.endsWith('/demos/upload')) {
        const accessToken = new Headers(init?.headers).get('Authorization')?.replace('Bearer ', '') ?? ''
        calls.uploadTokens.push(accessToken)
        return network.upload(accessToken)
      }
      throw new Error(`unexpected request to ${url}`)
    })
  )
  return calls
}

async function startWith(auth: AuthConfig) {
  vi.resetModules()
  const config = await import('./config')
  const { DemoWatcherService } = await import('./demo-watcher-service')
  config.setUt99InstallPath(join(root, 'UT99'))
  config.setDemoWatcherConfig({
    autoUpload: 'World Records Only',
    postUploadAction: 'Do Nothing',
    discardDemoAction: 'Do Nothing',
  })
  config.setAuthConfig(auth)
  watcher = new DemoWatcherService()
  watcher.startWatching()
}

function settledState(timeout = 1000) {
  return vi.waitFor(
    () => {
      const state = JSON.parse(readFileSync(join(dirs.userData, 'demo-watcher-state.json'), 'utf8')) as WatcherState
      expect(state.jobs.length + state.completed.length).toBeGreaterThan(0)
      return state
    },
    { timeout }
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  root = mkdtempSync(join(tmpdir(), 'utbt-demo-watcher-'))
  dirs.userData = join(root, 'userData')
  dirs.app = join(root, 'app')
  mkdirSync(dirs.userData)
  mkdirSync(join(dirs.app, 'resources', 'bin'), { recursive: true })
  writeFileSync(join(dirs.app, 'resources', 'bin', 'ut99-strings.exe'), '')
  mkdirSync(join(root, 'UT99', 'System'), { recursive: true })
  const demo = join(root, 'UT99', 'System', DEMO)
  writeFileSync(demo, 'demo')
  utimesSync(demo, NOW / 1000, NOW / 1000)
})

afterEach(() => {
  watcher?.stopWatching()
  watcher = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
  rmSync(root, { recursive: true, force: true })
})

describe('demo upload sign-in', () => {
  it('refreshes an expired sign-in before uploading', async () => {
    const calls = stubNetwork({ refresh: refreshed, upload: acceptsOnly('fresh-access-token') })

    await startWith(expired)
    const state = await settledState()

    expect(calls.uploadTokens).toEqual(['fresh-access-token'])
    expect(state.completed.map((entry) => entry.status)).toEqual(['uploaded'])
    expect(state.jobs).toEqual([])
  })

  it('keeps the demo queued for retry, without sending the expired token, when the refresh fails', async () => {
    const calls = stubNetwork({ refresh: refreshRefused, upload: acceptsOnly('fresh-access-token') })

    await startWith(expired)
    const state = await settledState()

    expect(calls.refreshes).toBe(1)
    expect(calls.uploadTokens).toEqual([])
    expect(state.jobs.map((job) => job.filename)).toEqual([DEMO])
    expect(state.completed).toEqual([])
  })

  it('refreshes once and retries when the upload is refused as unauthorised', async () => {
    const calls = stubNetwork({ refresh: refreshed, upload: acceptsOnly('fresh-access-token') })

    await startWith(signedIn)
    const state = await settledState()

    expect(calls.refreshes).toBe(1)
    expect(calls.uploadTokens).toEqual(['old-access-token', 'fresh-access-token'])
    expect(state.completed.map((entry) => entry.status)).toEqual(['uploaded'])
  })

  it('refreshes only once when the retried upload is refused too, and keeps the demo queued', async () => {
    const calls = stubNetwork({ refresh: refreshed, upload: unauthorised })

    await startWith(signedIn)
    const state = await settledState()

    expect(calls.refreshes).toBe(1)
    expect(calls.uploadTokens).toEqual(['old-access-token', 'fresh-access-token'])
    expect(state.jobs.map((job) => job.filename)).toEqual([DEMO])
    expect(state.completed).toEqual([])
  })

  it('does not refresh again when a later attempt of the same upload is refused', async () => {
    const answers = [unauthorised, capNotFoundYet, unauthorised]
    const calls = stubNetwork({ refresh: refreshed, upload: () => answers.shift()!() })

    await startWith(signedIn)
    const state = await settledState(4000)

    expect(calls.refreshes).toBe(1)
    expect(calls.uploadTokens).toEqual(['old-access-token', 'fresh-access-token', 'fresh-access-token'])
    expect(state.jobs.map((job) => job.filename)).toEqual([DEMO])
  })

  it('keeps the demo queued for retry when the refresh after a refused upload fails', async () => {
    const calls = stubNetwork({ refresh: refreshRefused, upload: unauthorised })

    await startWith(signedIn)
    const state = await settledState()

    expect(calls.refreshes).toBe(1)
    expect(calls.uploadTokens).toEqual(['old-access-token'])
    expect(state.jobs.map((job) => job.filename)).toEqual([DEMO])
    expect(state.completed).toEqual([])
  })
})

describe('demo upload outcome', () => {
  it('counts a demo the server already has as uploaded, from the success status alone', async () => {
    stubNetwork({
      refresh: refreshed,
      upload: () => new Response(JSON.stringify({ success: true, message: 'Demo upload already processed' })),
    })

    await startWith(signedIn)
    const state = await settledState()

    expect(state.completed.map((entry) => entry.status)).toEqual(['uploaded'])
    expect(watcher?.getUploadLogs()).toMatchObject([{ filename: DEMO, status: 'success' }])
  })

  it('keeps a refused upload queued for retry whatever its message says', async () => {
    stubNetwork({
      refresh: refreshed,
      upload: () => new Response(JSON.stringify({ success: false, reason: 'Demo already exists' }), { status: 400 }),
    })

    await startWith(signedIn)
    const state = await settledState()

    expect(state.jobs.map((job) => job.filename)).toEqual([DEMO])
    expect(state.completed).toEqual([])
  })
})
