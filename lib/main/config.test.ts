import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCamFps, getCamVolume, setActiveProfile, setCamFps, setCamVolume, type AuthConfig } from './config'

const userData = vi.hoisted(() => ({ path: '' }))
const encryption = vi.hoisted(() => ({ available: false }))
const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }))

vi.mock('electron', () => ({
    app: { getPath: () => userData.path },
    safeStorage: {
        isEncryptionAvailable: () => encryption.available,
        encryptString: (value: string) => Buffer.from(`sealed(${value})`),
        decryptString: (sealed: Buffer) => {
            const opened = /^sealed\((.*)\)$/.exec(sealed.toString())
            if (!opened) throw new Error('cannot decrypt')
            return opened[1]
        },
    },
}))

vi.mock('./logging-service', () => ({ loggingService: log }))

function configFile() {
    return join(userData.path, 'config', 'config.json')
}

function storeRaw(content: string) {
    mkdirSync(join(userData.path, 'config'), { recursive: true })
    writeFileSync(configFile(), content)
}

function storedConfig() {
    return JSON.parse(readFileSync(configFile(), 'utf-8'))
}

async function freshConfigModule() {
    vi.resetModules()
    return import('./config')
}

const signIn: AuthConfig = {
    discordId: '123456789012345678',
    username: 'runner',
    avatar: 'a1b2',
    accessToken: 'access-token-value',
    refreshToken: 'refresh-token-value',
    expiresAt: 1_900_000_000_000,
}

beforeEach(() => {
    userData.path = mkdtempSync(join(tmpdir(), 'utbt-config-'))
    encryption.available = false
    vi.clearAllMocks()
})

afterEach(() => {
    rmSync(userData.path, { recursive: true, force: true })
})

describe('auth tokens without encryption', () => {
    it('keeps a sign-in for the session without writing any token to the config file', async () => {
        const config = await freshConfigModule()
        config.setActiveProfile('Tournament')

        config.setAuthConfig(signIn)

        const written = readFileSync(configFile(), 'utf-8')
        expect(written).not.toContain('access-token-value')
        expect(written).not.toContain('refresh-token-value')
        expect(storedConfig()).toEqual({ activeProfile: 'Tournament' })
        expect(config.getAuthConfig()).toEqual(signIn)
    })

    it('forgets the session on sign-out', async () => {
        const config = await freshConfigModule()
        config.setAuthConfig(signIn)

        config.clearAuthConfig()

        expect(config.getAuthConfig()).toBeUndefined()
    })

    it('starts the next launch signed out', async () => {
        const firstLaunch = await freshConfigModule()
        firstLaunch.setAuthConfig(signIn)

        const nextLaunch = await freshConfigModule()

        expect(nextLaunch.getAuthConfig()).toBeUndefined()
    })

    it('logs once, without any token value, that sign-ins last only for the session', async () => {
        const config = await freshConfigModule()

        config.getAuthConfig()
        config.setAuthConfig(signIn)
        config.getAuthConfig()
        config.setAuthConfig({ ...signIn, accessToken: 'second-access-token' })
        config.clearAuthConfig()

        const calls = [...log.info.mock.calls, ...log.warn.mock.calls]
        expect(calls).toHaveLength(1)
        expect(calls[0][0]).toMatch(/session/i)
        const logged = JSON.stringify(calls)
        expect(logged).not.toContain('access-token-value')
        expect(logged).not.toContain('refresh-token-value')
        expect(logged).not.toContain('second-access-token')
    })

    it('drops an earlier encrypted sign-in from the file when signing in for the session', async () => {
        storeRaw(JSON.stringify({ auth: { ...signIn, accessToken: 'enc:b2xk', refreshToken: 'enc:b2xk' } }))
        const config = await freshConfigModule()

        config.setAuthConfig(signIn)

        expect(storedConfig()).toEqual({})
        expect(config.getAuthConfig()).toEqual(signIn)
    })
})

describe('auth tokens with encryption', () => {
    beforeEach(() => {
        encryption.available = true
    })

    it('stores both tokens encrypted and reads them back', async () => {
        const config = await freshConfigModule()

        config.setAuthConfig(signIn)

        const written = readFileSync(configFile(), 'utf-8')
        expect(written).not.toContain('access-token-value')
        expect(written).not.toContain('refresh-token-value')
        expect(storedConfig().auth).toEqual({
            ...signIn,
            accessToken: `enc:${Buffer.from('sealed(access-token-value)').toString('base64')}`,
            refreshToken: `enc:${Buffer.from('sealed(refresh-token-value)').toString('base64')}`,
        })
        expect(config.getAuthConfig()).toEqual(signIn)
    })

    it('keeps the sign-in for the next launch', async () => {
        const firstLaunch = await freshConfigModule()
        firstLaunch.setAuthConfig(signIn)

        const nextLaunch = await freshConfigModule()

        expect(nextLaunch.getAuthConfig()).toEqual(signIn)
    })

    it('removes the sign-in from the file on sign-out', async () => {
        const config = await freshConfigModule()
        config.setActiveProfile('Tournament')
        config.setAuthConfig(signIn)

        config.clearAuthConfig()

        expect(storedConfig()).toEqual({ activeProfile: 'Tournament' })
        expect(config.getAuthConfig()).toBeUndefined()
    })

    it('reads a token that cannot be decrypted as empty', async () => {
        storeRaw(JSON.stringify({ auth: { ...signIn, accessToken: 'enc:!!', refreshToken: 'enc:!!' } }))
        const config = await freshConfigModule()

        expect(config.getAuthConfig()).toEqual({ ...signIn, accessToken: '', refreshToken: '' })
    })

    it('does not log that sign-ins are session-only', async () => {
        const config = await freshConfigModule()

        config.setAuthConfig(signIn)
        config.getAuthConfig()

        expect(log.warn).not.toHaveBeenCalled()
    })
})

describe('plaintext tokens left by an earlier version', () => {
    it.each([false, true])('are deleted from the config file on load (encryption available: %s)', async (available) => {
        encryption.available = available
        storeRaw(JSON.stringify({ activeProfile: 'Tournament', auth: signIn }))
        const config = await freshConfigModule()

        expect(config.getActiveProfile()).toBe('Tournament')

        const written = readFileSync(configFile(), 'utf-8')
        expect(written).not.toContain('access-token-value')
        expect(written).not.toContain('refresh-token-value')
        expect(storedConfig()).toEqual({ activeProfile: 'Tournament' })
        expect(config.getAuthConfig()).toBeUndefined()
    })

    it('are deleted when only one of the two tokens is plaintext', async () => {
        encryption.available = true
        storeRaw(JSON.stringify({ auth: { ...signIn, accessToken: 'enc:b2xk' } }))
        const config = await freshConfigModule()

        expect(config.getAuthConfig()).toBeUndefined()
        expect(readFileSync(configFile(), 'utf-8')).not.toContain('refresh-token-value')
    })

    it('log the removal without any token value', async () => {
        storeRaw(JSON.stringify({ auth: signIn }))
        const config = await freshConfigModule()

        config.getActiveProfile()

        const logged = JSON.stringify([...log.info.mock.calls, ...log.warn.mock.calls])
        expect(logged).toMatch(/sign-in/i)
        expect(logged).not.toContain('access-token-value')
        expect(logged).not.toContain('refresh-token-value')
    })

    it('leave an encrypted sign-in in place', async () => {
        const encrypted = { ...signIn, accessToken: 'enc:YWJj', refreshToken: 'enc:ZGVm' }
        storeRaw(JSON.stringify({ auth: encrypted }))
        const config = await freshConfigModule()

        config.getActiveProfile()

        expect(storedConfig()).toEqual({ auth: encrypted })
    })
})

describe('cam fps preference', () => {
    it('defaults to 120 when nothing is stored', () => {
        expect(getCamFps()).toBe(120)
    })

    it('persists the chosen value in the config file for the next start', () => {
        setCamFps(60)

        expect(JSON.parse(readFileSync(configFile(), 'utf-8')).camFps).toBe(60)
        expect(getCamFps()).toBe(60)

        setCamFps(120)

        expect(getCamFps()).toBe(120)
    })

    it('keeps the rest of the config when it is saved', () => {
        setActiveProfile('Tournament')
        setCamFps(60)

        expect(JSON.parse(readFileSync(configFile(), 'utf-8'))).toEqual({ activeProfile: 'Tournament', camFps: 60 })
    })

    it('falls back to 120 for a stored value that is not 60 or 120', () => {
        for (const camFps of [30, 144, '60', null, true, { fps: 60 }]) {
            storeRaw(JSON.stringify({ camFps }))
            expect(getCamFps()).toBe(120)
        }
    })

    it('falls back to 120 when the config file is unreadable', () => {
        storeRaw('{ not json')

        expect(getCamFps()).toBe(120)
    })
})

describe('cam volume preference', () => {
    it('defaults to 50 when nothing is stored', () => {
        expect(getCamVolume()).toBe(50)
    })

    it('persists the chosen value next to the rest of the config', () => {
        setCamFps(60)
        setCamVolume(30)

        expect(JSON.parse(readFileSync(configFile(), 'utf-8'))).toEqual({ camFps: 60, camVolume: 30 })
        expect(getCamVolume()).toBe(30)

        setCamVolume(0)

        expect(getCamVolume()).toBe(0)
    })

    it('falls back to 50 for a stored value that is not a whole percentage', () => {
        for (const camVolume of [-5, 101, 12.5, '30', null, true]) {
            storeRaw(JSON.stringify({ camVolume }))
            expect(getCamVolume()).toBe(50)
        }
    })
})
