import { DEFAULT_SOUND_VOLUME } from '../pickBanSoundPreference'

export interface StreamSound {
    muted: boolean
    volume: number
}

export function isStreamSoundMuted(search: string): boolean {
    return new URLSearchParams(search).get('sound') === '0'
}

export function streamSoundVolume(search: string): number {
    const raw = new URLSearchParams(search).get('volume')?.trim()
    const percent = raw ? Number(raw) : Number.NaN
    if (!Number.isFinite(percent)) return DEFAULT_SOUND_VOLUME
    return Math.min(100, Math.max(0, percent)) / 100
}

export function streamSoundOf(search: string): StreamSound {
    return { muted: isStreamSoundMuted(search), volume: streamSoundVolume(search) }
}
