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

function parseServerDate(added: string): Date {
    const iso = added.includes('T') ? added : added.replace(' ', 'T')
    const withZone = /[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`
    return new Date(withZone)
}

export function formatTimeAgo(added: string): string {
    const then = parseServerDate(added)
    if (isNaN(then.getTime())) return '—'
    const secs = Math.floor((Date.now() - then.getTime()) / 1000)
    if (secs < 45) return 'just now'
    const mins = Math.floor(secs / 60)
    if (mins < 60) return `${Math.max(1, mins)}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    if (days < 365) return `${Math.floor(days / 30)}mo ago`
    return `${Math.floor(days / 365)}y ago`
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
