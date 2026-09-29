import type { EventMatchStatus } from '@/app/utils/api'
import type { StreamMatch, StreamScoreSource, StreamSide } from '../../streamDesk'
import { formatMatchTime } from './currentMatchView'

const FINISHED: ReadonlySet<EventMatchStatus> = new Set(['complete', 'forfeit', 'cancelled', 'bye'])
const SIDES: readonly StreamSide[] = ['a', 'b']

const SOURCE_LABELS: Record<StreamScoreSource, string> = {
    official: 'Official',
    live: 'Live',
    override: 'Override',
}

export interface ScoreSideCell {
    side: StreamSide
    team: string
    caps: number
    canRemove: boolean
    canAdd: boolean
}

export interface ScoreMapRow {
    ordinal: number
    label: string
    mapName: string | null
    current: boolean
    source: StreamScoreSource
    sourceLabel: string
    winnerText: string | null
    lockedNote: string | null
    sides: ScoreSideCell[]
}

export interface ScoreView {
    liveSet: boolean
    liveText: string
    seriesText: string
    finished: boolean
    rows: ScoreMapRow[]
}

function teamName(match: StreamMatch, side: StreamSide): string {
    return match.teams?.[side]?.name ?? `Team ${side.toUpperCase()}`
}

function liveText(match: StreamMatch, now: number): string {
    if (match.live_at) return `Live since ${formatMatchTime(match.live_at, now)}`
    if (match.pick_ban_status === 'complete') return 'Not marked live. The live score counts from the end of pick & ban.'
    return 'Not marked live. The live score starts counting once you mark the match live.'
}

function lockedNote(match: StreamMatch, finished: boolean, source: StreamScoreSource, decided: boolean, mapName: string | null): string | null {
    if (finished) return 'The match is over, so only the official result shows.'
    if (source === 'official') return 'An official result replaces the live score here.'
    if (!mapName) return 'No map picked yet.'
    if (match.score.live_decided && !decided) return 'The series is already decided.'
    return null
}

export function buildScoreView(match: StreamMatch | null, now: number): ScoreView | null {
    if (!match?.score?.maps) return null
    const finished = FINISHED.has(match.status)
    const names = new Map((match.maps ?? []).map(entry => [entry.ordinal, entry.map]))

    const rows = match.score.maps.map((entry): ScoreMapRow => {
        const mapName = names.get(entry.ordinal) ?? null
        const note = lockedNote(match, finished, entry.source, entry.decided, mapName)
        return {
            ordinal: entry.ordinal,
            label: `Map ${entry.ordinal + 1}`,
            mapName,
            current: match.score.current_map === entry.ordinal,
            source: entry.source,
            sourceLabel: SOURCE_LABELS[entry.source],
            winnerText: entry.winner ? `${teamName(match, entry.winner)} won` : null,
            lockedNote: note,
            sides: SIDES.map(side => ({
                side,
                team: teamName(match, side),
                caps: entry.caps[side],
                canRemove: note === null && entry.caps[side] > 0,
                canAdd: note === null && !(entry.decided && entry.winner === side),
            })),
        }
    })

    return {
        liveSet: !!match.live_at,
        liveText: liveText(match, now),
        seriesText: `${teamName(match, 'a')} ${match.score.series.a} – ${match.score.series.b} ${teamName(match, 'b')}`,
        finished,
        rows,
    }
}
