export function formatCapTime(seconds: number): string {
    const totalMs = Math.round(seconds * 1000)
    const totalSecs = Math.floor(totalMs / 1000)
    const hours = Math.floor(totalSecs / 3600)
    const minutes = Math.floor((totalSecs % 3600) / 60)
    const secs = totalSecs % 60
    const ms = totalMs % 1000
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
