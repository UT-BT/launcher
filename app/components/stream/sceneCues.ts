import { soundScheduleAt, type PickBanSoundSchedule } from '@/app/components/pages/events/pickban/pickBanSoundCues'
import { createSoundPlayer, masterGainOf, type SoundPlayer } from '@/app/components/pages/events/pickban/pickBanSoundPlayer'
import { SOUND_HIT_MS, SOUND_URLS } from '@/app/components/pages/events/pickban/pickBanSounds'
import type { StreamSound } from '@/app/components/pages/events/pickban/stream/streamSound'

export type SceneCueId = 'map-win' | 'match-winner' | 'countdown-zero'

export const SCENE_CUE_IDS: readonly SceneCueId[] = ['map-win', 'match-winner', 'countdown-zero']

export const SCENE_CUE_URLS: { [id in SceneCueId]: string } = {
    'map-win': SOUND_URLS.pick,
    'match-winner': SOUND_URLS.decider,
    'countdown-zero': SOUND_URLS.intro,
}

export const SCENE_CUE_HIT_MS: { [id in SceneCueId]: number } = {
    'map-win': SOUND_HIT_MS.pick,
    'match-winner': SOUND_HIT_MS.decider,
    'countdown-zero': SOUND_HIT_MS.intro,
}

export interface SceneCuePlayer {
    preload: () => Promise<void>
    unlock: () => void
    setSound: (sound: StreamSound) => void
    play: (id: SceneCueId, hitInMs?: number) => void
    dispose: () => void
}

export type SceneSoundPlayerFactory = (urls: { [id in SceneCueId]: string }, volume: number) => SoundPlayer<SceneCueId>

const PLAY_NOW: PickBanSoundSchedule = { delayMs: 0, offsetMs: 0 }

export function isSceneSoundAudible(sound: StreamSound): boolean {
    return !sound.muted && masterGainOf(sound.volume) > 0
}

export function sceneCueSchedule(id: SceneCueId, hitInMs?: number): PickBanSoundSchedule | null {
    if (hitInMs === undefined) return PLAY_NOW
    return soundScheduleAt(hitInMs, SCENE_CUE_HIT_MS[id], 0)
}

export function createSceneCuePlayer(initialSound: StreamSound, createPlayer: SceneSoundPlayerFactory = createSoundPlayer): SceneCuePlayer {
    let sound = initialSound
    let player: SoundPlayer<SceneCueId> | null = null
    let loading: Promise<void> = Promise.resolve()
    let wanted = false

    function ensurePlayer(): SoundPlayer<SceneCueId> | null {
        if (!wanted || !isSceneSoundAudible(sound)) return null
        if (player) return player
        player = createPlayer(SCENE_CUE_URLS, sound.volume)
        loading = player.preload()
        return player
    }

    return {
        preload() {
            wanted = true
            ensurePlayer()
            return loading
        },
        unlock() {
            ensurePlayer()?.unlock()
        },
        setSound(next) {
            sound = next
            player?.setVolume(isSceneSoundAudible(next) ? next.volume : 0)
            ensurePlayer()
        },
        play(id, hitInMs) {
            const schedule = sceneCueSchedule(id, hitInMs)
            const audible = ensurePlayer()
            if (audible && schedule) audible.play(id, schedule)
        },
        dispose() {
            wanted = false
            player?.dispose()
            player = null
        },
    }
}
