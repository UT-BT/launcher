import { describe, expect, it, vi } from 'vitest'
import type { SoundPlayer } from '@/app/components/pages/events/pickban/pickBanSoundPlayer'
import { SOUND_HIT_MS, SOUND_URLS } from '@/app/components/pages/events/pickban/pickBanSounds'
import {
    SCENE_CUE_HIT_MS,
    SCENE_CUE_IDS,
    SCENE_CUE_URLS,
    createSceneCuePlayer,
    isSceneSoundAudible,
    sceneCueSchedule,
    type SceneCueId,
} from './sceneCues'

function fakePlayer() {
    const player: SoundPlayer<SceneCueId> = {
        preload: vi.fn(() => Promise.resolve()),
        unlock: vi.fn(),
        setVolume: vi.fn(),
        play: vi.fn(),
        preview: vi.fn(),
        dispose: vi.fn(),
    }
    const create = vi.fn((_urls: { [id in SceneCueId]: string }, _volume: number) => player)
    return { player, create }
}

describe('scene cue ids', () => {
    it('are the map-win reveal, the match winner and the countdown hitting zero', () => {
        expect(SCENE_CUE_IDS).toEqual(['map-win', 'match-winner', 'countdown-zero'])
    })

    it('reuse the pick/ban sound files', () => {
        expect(SCENE_CUE_URLS).toEqual({
            'map-win': SOUND_URLS.pick,
            'match-winner': SOUND_URLS.decider,
            'countdown-zero': SOUND_URLS.intro,
        })
    })

    it('know where each file hits', () => {
        expect(SCENE_CUE_HIT_MS).toEqual({
            'map-win': SOUND_HIT_MS.pick,
            'match-winner': SOUND_HIT_MS.decider,
            'countdown-zero': SOUND_HIT_MS.intro,
        })
    })
})

describe('isSceneSoundAudible', () => {
    it('is audible when not muted and the volume is above zero', () => {
        expect(isSceneSoundAudible({ muted: false, volume: 0.4 })).toBe(true)
    })

    it('is silent when muted', () => {
        expect(isSceneSoundAudible({ muted: true, volume: 0.4 })).toBe(false)
    })

    it('is silent at zero volume or a volume that is not a number', () => {
        expect(isSceneSoundAudible({ muted: false, volume: 0 })).toBe(false)
        expect(isSceneSoundAudible({ muted: false, volume: Number.NaN })).toBe(false)
    })
})

describe('sceneCueSchedule', () => {
    it('plays the whole file at once when no hit is given', () => {
        expect(sceneCueSchedule('map-win')).toEqual({ delayMs: 0, offsetMs: 0 })
    })

    it('delays the file so its hit lands on the given beat', () => {
        expect(sceneCueSchedule('countdown-zero', SCENE_CUE_HIT_MS['countdown-zero'] + 200)).toEqual({ delayMs: 200, offsetMs: 0 })
    })

    it('skips into the file when the beat is sooner than its hit', () => {
        expect(sceneCueSchedule('match-winner', 40)).toEqual({ delayMs: 0, offsetMs: SCENE_CUE_HIT_MS['match-winner'] - 40 })
    })
})

describe('createSceneCuePlayer', () => {
    it('plays every cue at the audible volume', () => {
        const { player, create } = fakePlayer()
        const cues = createSceneCuePlayer({ muted: false, volume: 0.6 }, create)
        void cues.preload()
        for (const id of SCENE_CUE_IDS) cues.play(id)
        expect(create).toHaveBeenCalledWith(SCENE_CUE_URLS, 0.6)
        expect(player.preload).toHaveBeenCalledTimes(1)
        expect(vi.mocked(player.play).mock.calls).toEqual(SCENE_CUE_IDS.map((id) => [id, { delayMs: 0, offsetMs: 0 }]))
    })

    it('passes a hit schedule through', () => {
        const { player, create } = fakePlayer()
        const cues = createSceneCuePlayer({ muted: false, volume: 0.6 }, create)
        void cues.preload()
        cues.play('map-win', 500)
        expect(player.play).toHaveBeenCalledWith('map-win', sceneCueSchedule('map-win', 500))
    })

    it('plays nothing and opens no audio when muted', () => {
        const { player, create } = fakePlayer()
        const cues = createSceneCuePlayer({ muted: true, volume: 0.6 }, create)
        void cues.preload()
        cues.unlock()
        for (const id of SCENE_CUE_IDS) cues.play(id)
        expect(create).not.toHaveBeenCalled()
        expect(player.play).not.toHaveBeenCalled()
    })

    it('plays nothing and opens no audio at zero volume', () => {
        const { player, create } = fakePlayer()
        const cues = createSceneCuePlayer({ muted: false, volume: 0 }, create)
        void cues.preload()
        for (const id of SCENE_CUE_IDS) cues.play(id)
        expect(create).not.toHaveBeenCalled()
        expect(player.play).not.toHaveBeenCalled()
    })

    it('goes silent when the sound is muted later', () => {
        const { player, create } = fakePlayer()
        const cues = createSceneCuePlayer({ muted: false, volume: 0.6 }, create)
        void cues.preload()
        cues.setSound({ muted: true, volume: 0.6 })
        cues.play('match-winner')
        cues.setSound({ muted: false, volume: 0 })
        cues.play('match-winner')
        expect(player.play).not.toHaveBeenCalled()
    })

    it('follows a volume change', () => {
        const { player, create } = fakePlayer()
        const cues = createSceneCuePlayer({ muted: false, volume: 0.6 }, create)
        void cues.preload()
        cues.setSound({ muted: false, volume: 0.2 })
        expect(player.setVolume).toHaveBeenLastCalledWith(0.2)
    })

    it('loads the cues once the sound is turned up from zero', () => {
        const { player, create } = fakePlayer()
        const cues = createSceneCuePlayer({ muted: false, volume: 0 }, create)
        void cues.preload()
        cues.setSound({ muted: false, volume: 0.5 })
        cues.play('countdown-zero')
        expect(create).toHaveBeenCalledWith(SCENE_CUE_URLS, 0.5)
        expect(player.preload).toHaveBeenCalledTimes(1)
        expect(player.play).toHaveBeenCalledWith('countdown-zero', { delayMs: 0, offsetMs: 0 })
    })

    it('disposes the audio it opened', () => {
        const { player, create } = fakePlayer()
        const cues = createSceneCuePlayer({ muted: false, volume: 0.6 }, create)
        void cues.preload()
        cues.dispose()
        cues.play('map-win')
        expect(player.dispose).toHaveBeenCalledTimes(1)
        expect(player.play).not.toHaveBeenCalled()
    })

    it('opens the audio again when preloaded after a dispose', () => {
        const { player, create } = fakePlayer()
        const cues = createSceneCuePlayer({ muted: false, volume: 0.6 }, create)
        void cues.preload()
        cues.dispose()
        void cues.preload()
        cues.play('map-win')
        expect(create).toHaveBeenCalledTimes(2)
        expect(player.play).toHaveBeenCalledWith('map-win', { delayMs: 0, offsetMs: 0 })
    })
})
