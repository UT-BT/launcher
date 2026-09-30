import { parseApiInstant } from '@/app/utils/timezone'
import type { StreamMatch } from '../../streamDesk'
import { formatMatchTime } from './currentMatchView'
import { localInputFromInstant, utcFromLocalInput } from './localTime'

export const COUNTDOWN_STEPS = [5, 10, 15] as const

export interface CountdownView {
    scheduledText: string
    targetText: string
    moved: boolean
    inputValue: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface LocalTimeView {
    iso: string | null
    utcText: string | null
    notice: string | null
    error: string | null
}

export function buildLocalTimeView(value: string, timeZone: string): LocalTimeView | null {
    if (!value) return null
    const result = utcFromLocalInput(value, timeZone)
    const clock = value.slice(11, 16)
    if (result.status === 'invalid') return { iso: null, utcText: null, notice: null, error: 'Pick a date and time.' }
    if (result.status === 'gap') {
        return {
            iso: null,
            utcText: null,
            notice: null,
            error: `${clock} does not exist in ${timeZone} that day, because the clocks go forward. Pick a time before or after.`,
        }
    }
    const utc = new Date(result.iso)
    const utcDay = utc.toISOString().slice(0, 10)
    const dayNote = utcDay === value.slice(0, 10) ? '' : ` · ${utc.getUTCDate()} ${MONTHS[utc.getUTCMonth()]}`
    return {
        iso: result.iso,
        utcText: `= ${result.iso.slice(11, 16)} UTC${dayNote}`,
        notice: result.ambiguous ? `The clocks repeat ${clock} that night. This is the first one, before they go back.` : null,
        error: null,
    }
}

export function buildCountdownView(match: StreamMatch | null, now: number, timeZone: string): CountdownView | null {
    if (!match) return null
    const scheduled = parseApiInstant(match.scheduled_at)
    const target = parseApiInstant(match.countdown_at)
    return {
        scheduledText: formatMatchTime(match.scheduled_at, now),
        targetText: target === null ? 'No countdown yet' : formatMatchTime(match.countdown_at, now),
        moved: target !== null && target !== scheduled,
        inputValue: localInputFromInstant(match.countdown_at ?? match.scheduled_at, timeZone),
    }
}
