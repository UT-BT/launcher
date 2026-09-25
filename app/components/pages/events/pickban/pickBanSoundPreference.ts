const STORAGE_KEY = 'utbt:pickBanSound:v1'

export interface PickBanSoundPreference {
    volume: number
}

export const DEFAULT_SOUND_PREFERENCE: PickBanSoundPreference = { volume: 0.4 }

function soundVolumeOf(raw: unknown): number {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_SOUND_PREFERENCE.volume
    return Math.min(1, Math.max(0, raw))
}

export function parsePickBanSoundPreference(raw: string | null): PickBanSoundPreference {
    if (raw === null) return DEFAULT_SOUND_PREFERENCE
    try {
        const stored: unknown = JSON.parse(raw)
        if (typeof stored !== 'object' || stored === null) return DEFAULT_SOUND_PREFERENCE
        const { volume } = stored as { volume?: unknown }
        return { volume: soundVolumeOf(volume) }
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
