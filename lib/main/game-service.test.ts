import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getActiveProfile } from './config'
import { GameService } from './game-service'

const dirs = vi.hoisted(() => ({ userData: '', root: '' }))

vi.mock('electron', () => ({
    app: { getPath: () => dirs.userData },
    dialog: {},
    net: {},
    safeStorage: { isEncryptionAvailable: () => false },
}))
vi.mock('./logging-service', () => ({
    loggingService: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock('@/lib/main/demo-watcher-service', () => ({ demoWatcherService: { restart: vi.fn() } }))
vi.mock('./gateway-service', () => ({
    gatewayService: { get: vi.fn(async () => { throw new Error('offline') }), getUrl: vi.fn() },
}))
vi.mock('@/lib/main/cam-service', () => ({ camService: {} }))
vi.mock('../conveyor/handlers/ini-handler', () => ({ parseIni: () => ({}) }))

function makeInstall(name: string, ini = 'Name=Player'): string {
    const install = join(dirs.root, name)
    for (const folder of ['System', 'Textures', 'Maps', 'Music', 'Sounds']) {
        mkdirSync(join(install, folder), { recursive: true })
    }
    writeFileSync(join(install, 'System', 'UnrealTournament.exe'), name)
    writeFileSync(join(install, 'System', 'User.ini'), ini)
    writeFileSync(join(install, 'System', 'UnrealTournament.ini'), ini)
    return install
}

function profileNames(): string[] {
    const profilesDir = join(dirs.userData, 'profiles')
    return existsSync(profilesDir) ? readdirSync(profilesDir).sort() : []
}

let service: GameService

beforeEach(() => {
    dirs.root = mkdtempSync(join(tmpdir(), 'utbt-game-service-'))
    dirs.userData = join(dirs.root, 'userData')
    mkdirSync(dirs.userData)
    service = new GameService()
})

afterEach(() => {
    rmSync(dirs.root, { recursive: true, force: true })
})

describe('Browse profiles', () => {
    it('creates an Original and a Default profile for the first folder and activates Default', async () => {
        const install = makeInstall('UT')

        await service.validateAndSetInstallPath(install)

        expect(profileNames()).toEqual(['Default', 'Original'])
        expect(getActiveProfile()).toBe('Default')
    })

    it('Browse twice on the same folder leaves one profile pair', async () => {
        const install = makeInstall('UT')

        await service.validateAndSetInstallPath(install)
        await service.validateAndSetInstallPath(install)

        expect(profileNames()).toEqual(['Default', 'Original'])
    })

    it('recognises the same folder written with a different case or a trailing separator', async () => {
        const install = makeInstall('UT')

        await service.validateAndSetInstallPath(install)
        await service.validateAndSetInstallPath(`${install.toUpperCase()}\\`)

        expect(profileNames()).toEqual(['Default', 'Original'])
    })

    it('a new folder adds one pair and makes its Default active', async () => {
        const first = makeInstall('UT')
        const second = makeInstall('UT2')

        await service.validateAndSetInstallPath(first)
        await service.validateAndSetInstallPath(second)

        expect(profileNames()).toEqual(['Default', 'Default (1)', 'Original', 'Original (1)'])
        expect(getActiveProfile()).toBe('Default (1)')
    })

    it('going back to a known folder reuses its pair and makes its Default active without copying it over the install', async () => {
        const first = makeInstall('UT')
        const second = makeInstall('UT2')

        await service.validateAndSetInstallPath(first)
        await service.validateAndSetInstallPath(second)
        await service.validateAndSetInstallPath(first)

        expect(profileNames()).toEqual(['Default', 'Default (1)', 'Original', 'Original (1)'])
        expect(getActiveProfile()).toBe('Default')
    })

    it('Browse on the current folder keeps the active profile', async () => {
        const install = makeInstall('UT')
        await service.validateAndSetInstallPath(install)
        await service.createProfile('Competitive', install)

        await service.validateAndSetInstallPath(install)

        expect(getActiveProfile()).toBe('Competitive')
        expect(profileNames()).toEqual(['Competitive', 'Default', 'Original'])
    })

    it('Browse on the current folder keeps the active profile when it has to add the pair', async () => {
        const install = makeInstall('UT')
        await service.validateAndSetInstallPath(install)
        await service.createProfile('Competitive', install)
        rmSync(join(dirs.userData, 'profiles', 'Original', 'install.json'))
        rmSync(join(dirs.userData, 'profiles', 'Default', 'install.json'))

        await service.validateAndSetInstallPath(install)

        expect(getActiveProfile()).toBe('Competitive')
        expect(profileNames()).toEqual(['Competitive', 'Default', 'Default (1)', 'Original', 'Original (1)'])
    })

    it('recreates only the missing half of a known pair', async () => {
        const install = makeInstall('UT')
        await service.validateAndSetInstallPath(install)
        await service.renameProfile('Default', 'Mine')
        await service.deleteProfile('Mine')

        await service.validateAndSetInstallPath(install)

        expect(profileNames()).toEqual(['Default', 'Original'])
        expect(getActiveProfile()).toBe('Default')
    })

    it('an invalid folder creates no profiles', async () => {
        const result = await service.validateAndSetInstallPath(join(dirs.root, 'missing'))

        expect(result.success).toBe(false)
        expect(profileNames()).toEqual([])
    })
})

describe('reserved Original profiles', () => {
    it.each(['Original', 'original', 'Original (2)', 'ORIGINAL (12)', 'Original ', 'Original.'])(
        'creating a profile named "%s" is refused',
        async (name) => {
            const install = makeInstall('UT')

            await expect(service.createProfile(name, install)).rejects.toThrow('reserved')

            expect(profileNames()).toEqual([])
        },
    )

    it('overwriting the Original created by Browse is refused and leaves its snapshot alone', async () => {
        const install = makeInstall('UT', 'Name=First')
        await service.validateAndSetInstallPath(install)
        writeFileSync(join(install, 'System', 'User.ini'), 'Name=Changed')

        await expect(service.createProfile('Original', install)).rejects.toThrow('reserved')

        expect(readFileSync(join(dirs.userData, 'profiles', 'Original', 'User.ini'), 'utf-8')).toBe('Name=First')
        expect(getActiveProfile()).toBe('Default')
    })

    it('names that only start with Original are allowed', async () => {
        const install = makeInstall('UT')

        await service.createProfile('Original settings', install)

        expect(profileNames()).toEqual(['Original settings'])
    })

    it('renaming to or from a reserved name and deleting an Original are refused', async () => {
        const install = makeInstall('UT')
        await service.validateAndSetInstallPath(install)

        await expect(service.renameProfile('Default', 'Original (3)')).rejects.toThrow('reserved')
        await expect(service.renameProfile('Original', 'Backup')).rejects.toThrow('reserved')
        await expect(service.deleteProfile('Original')).rejects.toThrow('reserved')

        expect(profileNames()).toEqual(['Default', 'Original'])
    })
})
