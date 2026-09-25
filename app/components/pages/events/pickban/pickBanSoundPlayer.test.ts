import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPickBanSoundPlayer, masterGainOf } from './pickBanSoundPlayer'

describe('masterGainOf', () => {
    it('is silent at 0 and full at 1', () => {
        expect(masterGainOf(0)).toBe(0)
        expect(masterGainOf(1)).toBe(1)
    })

    it('follows the square of the volume so the slider moves more evenly in loudness', () => {
        expect(masterGainOf(0.6)).toBeCloseTo(0.36, 10)
        expect(masterGainOf(0.5)).toBeCloseTo(0.25, 10)
    })

    it('clamps a volume outside 0 to 1', () => {
        expect(masterGainOf(-0.5)).toBe(0)
        expect(masterGainOf(3)).toBe(1)
    })

    it('is silent for a volume that is not a number', () => {
        expect(masterGainOf(Number.NaN)).toBe(0)
    })
})

class FakeParam {
    value = 1
    cancelScheduledValues() {}
    setValueAtTime() {}
    linearRampToValueAtTime() {}
    setTargetAtTime() {}
}

class FakeAudioContext {
    static created: FakeAudioContext[] = []
    state: 'suspended' | 'running' | 'closed' = 'suspended'
    currentTime = 10
    destination = {}
    starts: { when: number; offset: number }[] = []

    constructor() {
        FakeAudioContext.created.push(this)
    }

    createGain() {
        return { gain: new FakeParam(), connect() {} }
    }

    createBufferSource() {
        const starts = this.starts
        return {
            buffer: null,
            connect() {},
            start(when: number, offset: number) {
                starts.push({ when, offset })
            },
            stop() {},
        }
    }

    decodeAudioData() {
        return Promise.resolve({})
    }

    resume() {
        this.state = 'running'
        return Promise.resolve()
    }

    close() {
        this.state = 'closed'
        return Promise.resolve()
    }
}

describe('createPickBanSoundPlayer', () => {
    beforeEach(() => {
        FakeAudioContext.created = []
        vi.stubGlobal('window', { AudioContext: FakeAudioContext })
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) })))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('decodes all five files up front', async () => {
        const player = createPickBanSoundPlayer(0.4)
        await player.preload()
        expect(fetch).toHaveBeenCalledTimes(5)
        player.dispose()
    })

    it('skips a cue due while the context is still suspended', async () => {
        const player = createPickBanSoundPlayer(0.4)
        await player.preload()
        player.play('pick', { delayMs: 0, offsetMs: 0 })
        expect(FakeAudioContext.created[0].starts).toEqual([])
        player.dispose()
    })

    it('plays the cues after a gesture unlocks the context', async () => {
        const player = createPickBanSoundPlayer(0.4)
        await player.preload()
        player.play('ban', { delayMs: 0, offsetMs: 0 })
        player.unlock()
        player.play('pick', { delayMs: 250, offsetMs: 0 })
        player.play('decider', { delayMs: 0, offsetMs: 120 })
        expect(FakeAudioContext.created).toHaveLength(1)
        expect(FakeAudioContext.created[0].starts).toEqual([
            { when: 10.25, offset: 0 },
            { when: 10, offset: 0.12 },
        ])
        player.dispose()
    })
})
