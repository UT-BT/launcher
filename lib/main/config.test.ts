import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCamFps, getCamVolume, setActiveProfile, setCamFps, setCamVolume } from './config'

const userData = vi.hoisted(() => ({ path: '' }))

vi.mock('electron', () => ({
    app: { getPath: () => userData.path },
    safeStorage: { isEncryptionAvailable: () => false },
}))

function configFile() {
    return join(userData.path, 'config', 'config.json')
}

function storeRaw(content: string) {
    mkdirSync(join(userData.path, 'config'), { recursive: true })
    writeFileSync(configFile(), content)
}

beforeEach(() => {
    userData.path = mkdtempSync(join(tmpdir(), 'utbt-config-'))
})

afterEach(() => {
    rmSync(userData.path, { recursive: true, force: true })
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
