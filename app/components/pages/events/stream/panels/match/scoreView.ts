import { ApiError, type EventMatchStatus } from '@/app/utils/api'
import type { StreamMapScore, StreamMatch, StreamScoreSource, StreamSide, StreamWinnerOverride } from '../../streamDesk'
import { formatMatchTime } from './currentMatchView'
import type { MapScoreState } from './scoreActions'

export const MIN_SCORE = 0
export const MAX_SCORE = 20
export const NO_WINNER_HINT = 'Map ended level? Close it here as a draw.'

const FINISHED: ReadonlySet<EventMatchStatus> = new Set(['complete', 'forfeit', 'cancelled', 'bye'])
const SIDES: readonly StreamSide[] = ['a', 'b']

const SOURCE_LABELS: Record<StreamScoreSource, string> = {
    official: 'Official',
    live: 'Live',
    manual: 'Manual',
}

export type ScoreWriteKind = 'map' | 'reset' | 'resetAll' | 'liveCounting'

const NO_EFFECT_MESSAGES: Record<ScoreWriteKind, string> = {
    map: 'Nothing changed: the map already shows that.',
    reset: 'Nothing to reset: that map already counts live.',
    resetAll: 'Nothing to reset: every map already counts live.',
    liveCounting: 'Nothing changed: live counting is already set that way.',
}

const REJECT_MESSAGES: Record<string, string> = {
    official_map: 'That map has an official result, so it can’t be edited.',
    invalid_request: `Scores go from ${MIN_SCORE} to ${MAX_SCORE}.`,
    unknown_map: 'That map is no longer part of this match.',
}

export interface ScoreSideCell {
    side: StreamSide
    team: string
    caps: number
    pinned: boolean
    canLower: boolean
    canRaise: boolean
}

export interface WinnerOption {
    value: StreamWinnerOverride
    label: string
}

export interface ScoreMapRow {
    ordinal: number
    label: string
    mapName: string | null
    pickedText: string | null
    current: boolean
    source: StreamScoreSource
    sourceLabel: string
    resultText: string | null
    locked: boolean
    lockedNote: string | null
    hint: string | null
    state: MapScoreState
    winner: StreamWinnerOverride
    winnerOptions: WinnerOption[]
    canReset: boolean
    sides: ScoreSideCell[]
}

export interface ScoreView {
    liveSet: boolean
    canClearLive: boolean
    liveText: string
    liveCounting: boolean
    liveCountingText: string
    seriesText: string
    finished: boolean
    canResetAll: boolean
    rows: ScoreMapRow[]
}

function teamName(match: StreamMatch, side: StreamSide): string {
    return match.teams?.[side]?.name ?? `Team ${side.toUpperCase()}`
}

function liveText(match: StreamMatch, finished: boolean, now: number): string {
    if (finished) return 'The match is over.'
    if (!match.live_since) return 'Not live yet. The match goes live when pick & ban ends. Without a pick & ban, press Match live.'
    const since = `Live since ${formatMatchTime(match.live_since, now)}`
    return match.live_source === 'pick_ban' ? `${since}, when pick & ban ended.` : since
}

function storedState(entry: StreamMapScore): MapScoreState {
    return { a: entry.pins?.a ?? null, b: entry.pins?.b ?? null, winner: entry.winner_override ?? 'auto' }
}

function hasStoredState(state: MapScoreState): boolean {
    return state.a !== null || state.b !== null || state.winner !== 'auto'
}

function lockedNote(match: StreamMatch, finished: boolean, entry: StreamMapScore): string | null {
    if (finished) return 'The match is over, so only the official result shows.'
    if (entry.source === 'official') return 'Official result. It can’t be edited here.'
    if (match.score.live_decided && !entry.decided) return 'The series is already decided.'
    return null
}

function pickedText(match: StreamMatch, kind: string | undefined, pickedBy: StreamSide | null | undefined): string | null {
    if (kind === 'decider') return 'Decider'
    return pickedBy ? `Picked by ${teamName(match, pickedBy)}` : null
}

function resultText(match: StreamMatch, entry: StreamMapScore): string | null {
    if (!entry.decided) return null
    return entry.winner ? `${teamName(match, entry.winner)} won` : 'Draw'
}

function winnerOptions(match: StreamMatch): WinnerOption[] {
    return [
        { value: 'auto', label: 'Auto' },
        { value: 'a', label: teamName(match, 'a') },
        { value: 'b', label: teamName(match, 'b') },
        { value: 'none', label: 'Draw' },
    ]
}

function mapRow(match: StreamMatch, finished: boolean, entry: StreamMapScore): ScoreMapRow {
    const slot = (match.maps ?? []).find(map => map.ordinal === entry.ordinal)
    const note = lockedNote(match, finished, entry)
    const locked = note !== null
    const state = storedState(entry)
    const current = match.score.current_map === entry.ordinal
    return {
        ordinal: entry.ordinal,
        label: `Map ${entry.ordinal + 1}`,
        mapName: slot?.map ?? null,
        pickedText: pickedText(match, slot?.kind, slot?.picked_by),
        current,
        source: entry.source,
        sourceLabel: SOURCE_LABELS[entry.source],
        resultText: resultText(match, entry),
        locked,
        lockedNote: note,
        hint: current && !locked ? NO_WINNER_HINT : null,
        state,
        winner: state.winner,
        winnerOptions: winnerOptions(match),
        canReset: !locked && hasStoredState(state),
        sides: SIDES.map(side => {
            const caps = entry.caps[side] ?? 0
            return {
                side,
                team: teamName(match, side),
                caps,
                pinned: state[side] !== null,
                canLower: !locked && caps > MIN_SCORE,
                canRaise: !locked && caps < MAX_SCORE,
            }
        }),
    }
}

export function buildScoreView(match: StreamMatch | null, now: number): ScoreView | null {
    if (!match?.score?.maps) return null
    const finished = FINISHED.has(match.status)
    const liveCounting = match.score.live_counting !== false
    const maps = [...match.score.maps].sort((left, right) => left.ordinal - right.ordinal)

    return {
        liveSet: !!match.live_since,
        canClearLive: !!match.live_at,
        liveText: liveText(match, finished, now),
        liveCounting,
        liveCountingText: liveCounting
            ? 'Runs from the servers count toward the score.'
            : 'Off: only official results and the scores you set count.',
        seriesText: `Series: ${teamName(match, 'a')} ${match.score.series.a} – ${match.score.series.b} ${teamName(match, 'b')}`,
        finished,
        canResetAll: !finished && maps.some(entry => hasStoredState(storedState(entry))),
        rows: maps.map(entry => mapRow(match, finished, entry)),
    }
}

export function stateWithPin(row: ScoreMapRow, side: StreamSide, value: number): MapScoreState {
    return { ...row.state, [side]: value }
}

export function stateWithWinner(row: ScoreMapRow, winner: StreamWinnerOverride): MapScoreState {
    return { ...row.state, winner }
}

export function parseScoreInput(text: string): number | null {
    const trimmed = text.trim()
    if (!/^\d+$/.test(trimmed)) return null
    const value = Number(trimmed)
    return value >= MIN_SCORE && value <= MAX_SCORE ? value : null
}

export function shouldSendTypedScore(cell: ScoreSideCell, value: number, edited: boolean): boolean {
    return value !== cell.caps || (edited && !cell.pinned)
}

export function scoreWriteMessage(error: unknown, kind: ScoreWriteKind): string {
    if (error instanceof ApiError && error.reason === 'no_effect') return NO_EFFECT_MESSAGES[kind]
    if (error instanceof ApiError && error.reason && REJECT_MESSAGES[error.reason]) return REJECT_MESSAGES[error.reason]
    return error instanceof Error && error.message ? error.message : 'Something went wrong.'
}
