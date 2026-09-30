import { parseApiInstant } from '@/app/utils/timezone'
import type { EventMatchStatus } from '@/app/utils/api'
import type { StreamAssignedMatch, StreamDesk, StreamReason } from '../../streamDesk'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const REASON_TEXT: Record<StreamReason, string> = {
    current: 'Chosen here as the current match.',
    live: 'Live now, so your scenes follow it.',
    'holding-finished': 'Finished. Your scenes hold it until you move on.',
    next: 'Your next assigned match by scheduled time.',
    none: 'No match to show. Your scenes show the event branding.',
}

export interface CurrentMatchRow {
    id: string
    title: string
    detail: string
    timeText: string
    status: EventMatchStatus
    streamUrl: string | null
    onScreen: boolean
    chosen: boolean
    notPublic: boolean
    finished: boolean
}

export interface CurrentMatchView {
    rows: CurrentMatchRow[]
    onScreen: CurrentMatchRow | null
    reasonText: string
    next: CurrentMatchRow | null
    chosenId: string | null
    chosenNote: string | null
}

function relative(delta: number): string {
    const abs = Math.abs(delta)
    if (abs < MINUTE) return 'now'
    const days = Math.floor(abs / DAY)
    const hours = Math.floor((abs % DAY) / HOUR)
    const minutes = Math.floor((abs % HOUR) / MINUTE)
    const span = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
    return delta > 0 ? `in ${span}` : `${span} ago`
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function twoDigits(value: number): string {
    return String(value).padStart(2, '0')
}

function utcDay(date: Date): string {
    return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
}

export function formatMatchTime(iso: string | null, now: number): string {
    const at = parseApiInstant(iso)
    if (at === null) return 'Not scheduled'
    const date = new Date(at)
    const day = utcDay(date) === utcDay(new Date(now)) ? '' : `${utcDay(date)} · `
    return `${day}${twoDigits(date.getUTCHours())}:${twoDigits(date.getUTCMinutes())} UTC · ${relative(at - now)}`
}

function matchTitle(match: StreamAssignedMatch): string {
    return `${match.teams.a?.name ?? 'TBD'} vs ${match.teams.b?.name ?? 'TBD'}`
}

function matchDetail(match: StreamAssignedMatch): string {
    const round = match.round.label || `Round ${match.round.no}`
    return [match.stage?.name, match.group?.name, round, `Bo${match.best_of}`].filter(Boolean).join(' · ')
}

function toRow(match: StreamAssignedMatch, desk: StreamDesk, now: number): CurrentMatchRow {
    return {
        id: match.id,
        title: matchTitle(match),
        detail: matchDetail(match),
        timeText: formatMatchTime(match.scheduled_at, now),
        status: match.status,
        streamUrl: match.stream_url,
        onScreen: desk.match?.id === match.id,
        chosen: desk.desk.current_match_id === match.id,
        notPublic: !match.public,
        finished: match.finished,
    }
}

function chosenNote(chosen: CurrentMatchRow | null): string | null {
    if (!chosen || chosen.onScreen) return null
    if (chosen.notPublic) return `${chosen.title} is chosen but not public yet, so your scenes can't show it until it is.`
    return `${chosen.title} is chosen but has finished, and another of your matches is live.`
}

export function buildCurrentMatchView(desk: StreamDesk, now: number): CurrentMatchView {
    const rows = desk.assigned_matches.map(match => toRow(match, desk, now))
    const chosenId = desk.desk.current_match_id
    const chosen = rows.find(row => row.id === chosenId) ?? null

    return {
        rows,
        onScreen: rows.find(row => row.onScreen) ?? null,
        reasonText: REASON_TEXT[desk.reason],
        next: desk.next_match ? toRow(desk.next_match, desk, now) : null,
        chosenId,
        chosenNote: chosenNote(chosen),
    }
}
