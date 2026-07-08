export function formatCapTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    const msStr = ms.toString().padStart(3, '0')
    const secsStr = secs.toString().padStart(2, '0')
    const minsStr = minutes.toString().padStart(2, '0')
    if (hours > 0) return `${hours}:${minsStr}:${secsStr}.${msStr}`
    return `${minsStr}:${secsStr}.${msStr}`
}

export function formatDelta(seconds: number): string {
    if (seconds < 60) return `${seconds.toFixed(3)}s`
    return formatCapTime(seconds)
}

export function formatAddedDate(added: string): string {
    const d = new Date(added)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
}

const NEW_MAP_WINDOW_DAYS = 30

export function isNew(added: string): boolean {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - NEW_MAP_WINDOW_DAYS)
    return new Date(added) >= cutoff
}

export function displayMapName(name: string): string {
    return name.replace('CTF-BT-', '').replace('CTF-BT+', '')
}

const TEAM_MAP_ROMAN_PLAYERS: Record<string, number> = {
    II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12,
}

export function isTeamMap(mapName: string): number | null {
    const match = /^CTF-BT-([IVX]+)-/.exec(mapName)
    if (!match) return null
    return TEAM_MAP_ROMAN_PLAYERS[match[1]] ?? null
}
