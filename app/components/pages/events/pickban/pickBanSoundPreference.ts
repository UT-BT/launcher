import { SOUND_PACK_IDS, type PickBanSoundPack } from './pickBanSounds'

const STORAGE_KEY = 'utbt:pickBanSound:v1'

export interface PickBanSoundPreference {
    pack: PickBanSoundPack
    volume: number
}

export const DEFAULT_SOUND_PREFERENCE: PickBanSoundPreference = { pack: 'cinematic', volume: 0.6 }

export function soundPackOf(raw: unknown): PickBanSoundPack {
    return SOUND_PACK_IDS.find((pack) => pack === raw) ?? DEFAULT_SOUND_PREFERENCE.pack
}

function soundVolumeOf(raw: unknown): number {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_SOUND_PREFERENCE.volume
    return Math.min(1, Math.max(0, raw))
}

export function parsePickBanSoundPreference(raw: string | null): PickBanSoundPreference {
    if (raw === null) return DEFAULT_SOUND_PREFERENCE
    try {
        const stored: unknown = JSON.parse(raw)
        if (typeof stored !== 'object' || stored === null) return DEFAULT_SOUND_PREFERENCE
        const { pack, volume } = stored as { pack?: unknown; volume?: unknown }
        return { pack: soundPackOf(pack), volume: soundVolumeOf(volume) }
    } catch {
        return DEFAULT_SOUND_PREFERENCE
    }
}

export function loadPickBanSoundPreference(): PickBanSoundPreference {
    try {
        return parsePickBanSoundPreference(window.localStorage.getItem(STORAGE_KEY))
    } catch {
        return DEFAULT_SOUND_PREFERENCE
    }
}

export function savePickBanSoundPreference(preference: PickBanSoundPreference): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preference))
    } catch {
        return
    }
}
