import { parseApiInstant } from '@/app/utils/timezone'
import type { StreamMatch } from '../../streamDesk'
import { formatMatchTime } from './currentMatchView'

export const COUNTDOWN_STEPS = [5, 10, 15] as const

export interface CountdownView {
    scheduledText: string
    targetText: string
    moved: boolean
    inputValue: string
}

function twoDigits(value: number): string {
    return String(value).padStart(2, '0')
}

export function utcInputValue(iso: string | null): string {
    const at = parseApiInstant(iso)
    if (at === null) return ''
    const date = new Date(at)
    return `${date.getUTCFullYear()}-${twoDigits(date.getUTCMonth() + 1)}-${twoDigits(date.getUTCDate())}T${twoDigits(date.getUTCHours())}:${twoDigits(date.getUTCMinutes())}`
}

export function isoFromUtcInput(value: string): string | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim())
    if (!match) return null
    const [, year, month, day, hour, minute] = match.map(Number)
    const at = Date.UTC(year, month - 1, day, hour, minute)
    const date = new Date(at)
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || hour > 23 || minute > 59) return null
    return date.toISOString().replace('.000Z', 'Z')
}

export function buildCountdownView(match: StreamMatch | null, now: number): CountdownView | null {
    if (!match) return null
    const scheduled = parseApiInstant(match.scheduled_at)
    const target = parseApiInstant(match.countdown_at)
    return {
        scheduledText: formatMatchTime(match.scheduled_at, now),
        targetText: target === null ? 'No countdown yet' : formatMatchTime(match.countdown_at, now),
        moved: target !== null && target !== scheduled,
        inputValue: utcInputValue(match.countdown_at ?? match.scheduled_at),
    }
}
