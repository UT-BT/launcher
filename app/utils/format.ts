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
    const d = parseApiDate(added)
    if (!d) return '—'
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
}

function parseServerDate(added: string): Date {
    if (/^[A-Za-z]{3},/.test(added.trim())) return new Date(added)
    const iso = added.includes('T') ? added : added.replace(' ', 'T')
    const withZone = /[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`
    return new Date(withZone)
}

export function parseApiDate(value: unknown): Date | null {
    if (typeof value !== 'string' || value.trim() === '') return null
    const d = parseServerDate(value)
    return isNaN(d.getTime()) ? null : d
}

const JUST_NOW_SECONDS = 45

function formatSpan(secs: number): string {
    const mins = Math.floor(secs / 60)
    if (mins < 60) return `${Math.max(1, mins)}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d`
    if (days < 30) return `${Math.floor(days / 7)}w`
    if (days < 365) return `${Math.floor(days / 30)}mo`
    return `${Math.floor(days / 365)}y`
}

export function formatTimeAgo(added: string): string {
    const then = parseApiDate(added)
    if (!then) return '—'
    const secs = Math.floor((Date.now() - then.getTime()) / 1000)
    if (secs <= -JUST_NOW_SECONDS) return `in ${formatSpan(-secs)}`
    if (secs < JUST_NOW_SECONDS) return 'just now'
    return `${formatSpan(secs)} ago`
}

const NEW_MAP_WINDOW_DAYS = 30

export function isNew(added: string): boolean {
    const d = parseApiDate(added)
    if (!d) return false
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - NEW_MAP_WINDOW_DAYS)
    return d >= cutoff
}

export function displayMapName(name: string | null | undefined): string {
    if (typeof name !== 'string') return ''
    return name.replace('CTF-BT-', '').replace('CTF-BT+', '')
}
