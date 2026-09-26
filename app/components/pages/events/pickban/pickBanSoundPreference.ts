import { getSynced, setSynced, subscribeSynced } from '@/app/utils/userState'

const STORAGE_KEY = 'utbt:pickBanSound:v1'

export interface PickBanSoundPreference {
    enabled: boolean
    volume: number
}

export const DEFAULT_SOUND_VOLUME = 0.4

export const DEFAULT_SOUND_PREFERENCE: PickBanSoundPreference = { enabled: false, volume: DEFAULT_SOUND_VOLUME }

function soundVolumeOf(raw: unknown): number {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_SOUND_VOLUME
    return Math.min(1, Math.max(0, raw))
}

export function parsePickBanSoundPreference(stored: unknown): PickBanSoundPreference {
    if (typeof stored !== 'object' || stored === null) return DEFAULT_SOUND_PREFERENCE
    const { enabled, volume } = stored as { enabled?: unknown; volume?: unknown }
    return { enabled: enabled === true, volume: soundVolumeOf(volume) }
}

export function loadPickBanSoundPreference(): PickBanSoundPreference {
    return parsePickBanSoundPreference(getSynced<unknown>(STORAGE_KEY, null))
}

export function savePickBanSoundPreference(preference: PickBanSoundPreference): void {
    setSynced(STORAGE_KEY, preference)
}

export function subscribePickBanSoundPreference(callback: () => void): () => void {
    return subscribeSynced(STORAGE_KEY, callback)
}
