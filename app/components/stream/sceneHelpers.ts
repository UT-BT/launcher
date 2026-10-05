import { parseApiInstant } from '@/app/utils/timezone'
import { PICK_BAN_TONES, type PickBanTone, type PickBanToneClasses } from '@/app/components/broadcast/broadcastTone'
import type { StreamMapScore, StreamMatch, StreamSide } from './data/streamHotState'

const MINUTE_MS = 60_000
const HOUR_MINUTES = 60
const DAY_MINUTES = 24 * HOUR_MINUTES
const WEEK_MINUTES = 7 * DAY_MINUTES
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export type SeriesFlag = 'won' | 'open'

function twoDigits(value: number): string {
    return String(value).padStart(2, '0')
}

function utcDay(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10)
}

export function utcTimeText(at: number, now: number): string {
    const date = new Date(at)
    const clock = `${twoDigits(date.getUTCHours())}:${twoDigits(date.getUTCMinutes())} UTC`
    if (utcDay(at) === utcDay(now)) return clock
    return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}, ${clock}`
}

function spanText(minutes: number): string {
    if (minutes >= WEEK_MINUTES) {
        const weeks = Math.round(minutes / WEEK_MINUTES)
        return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`
    }
    const days = Math.floor(minutes / DAY_MINUTES)
    const hours = Math.floor((minutes % DAY_MINUTES) / HOUR_MINUTES)
    const mins = minutes % HOUR_MINUTES
    const parts = days > 0 ? [`${days}d`, hours > 0 ? `${hours}h` : ''] : hours > 0 ? [`${hours}h`, mins > 0 ? `${mins}m` : ''] : [`${mins}m`]
    return parts.filter(Boolean).join(' ')
}

export function relativeTimeText(at: number, now: number): string {
    const diff = at - now
    if (Math.abs(diff) < MINUTE_MS) return 'now'
    return diff > 0 ? `in ${spanText(Math.ceil(diff / MINUTE_MS))}` : `${spanText(Math.floor(-diff / MINUTE_MS))} ago`
}

export function sceneTimeText(iso: string | null, now: number): string | null {
    const at = parseApiInstant(iso)
    if (at === null) return null
    return `${utcTimeText(at, now)} · ${relativeTimeText(at, now)}`
}

export function mapDrawn(score: Pick<StreamMapScore, 'decided' | 'winner'>): boolean {
    return score.decided && score.winner === null
}

export function seriesTarget(match: Pick<StreamMatch, 'best_of' | 'mode' | 'score'>): number {
    const decisive = Math.max(match.best_of - match.score.drawn_maps, 0)
    return match.mode === 'all_maps' ? decisive : Math.floor(decisive / 2) + 1
}

export function drawnMapsText(count: number): string | null {
    if (count === 0) return null
    return `${count} map${count === 1 ? '' : 's'} drawn`
}

export function seriesFlags(match: Pick<StreamMatch, 'best_of' | 'mode' | 'score'>): Record<StreamSide, SeriesFlag[]> {
    const target = seriesTarget(match)
    const flagsOf = (won: number): SeriesFlag[] => Array.from({ length: target }, (_, index) => (index < won ? 'won' : 'open'))
    return { a: flagsOf(match.score.series.a), b: flagsOf(match.score.series.b) }
}

export function formatLabel(match: Pick<StreamMatch, 'best_of' | 'caps_to_win'>): string {
    const bestOf = `Bo${match.best_of}`
    if (match.caps_to_win === null) return bestOf
    return `${bestOf} · first to ${match.caps_to_win}`
}

export function mapNumber(ordinal: number): number {
    return ordinal + 1
}

export function stageLine(match: Pick<StreamMatch, 'stage' | 'group' | 'round'>): string {
    return [match.stage.name, match.group?.name, match.round.label].filter(Boolean).join(' · ')
}

export function sideTone(side: StreamSide): PickBanTone {
    return side
}

export function sideToneClasses(side: StreamSide): PickBanToneClasses {
    return PICK_BAN_TONES[sideTone(side)]
}
