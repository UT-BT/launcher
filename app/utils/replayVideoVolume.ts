const STORAGE_KEY = 'utbt:replayVideoVolume:v1'

export function loadReplayVideoVolume(): number {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return 1
        const value = JSON.parse(raw) as unknown
        if (typeof value === 'number' && value >= 0 && value <= 1) return value
    } catch {
        // ignore corrupt or unavailable storage
    }
    return 1
}

export function saveReplayVideoVolume(volume: number): void {
    if (!Number.isFinite(volume)) return
    const clamped = Math.min(1, Math.max(0, volume))
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped))
    } catch {
        // localStorage may be full or unavailable; swallow.
    }
}
