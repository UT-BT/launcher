import type { StreamMatch, StreamScore, StreamSide } from '../../data/streamHotState'
import { mapNumber } from '../../sceneHelpers'
import type {
    BracketConsequenceTeam,
    GroupConsequenceTeam,
    PostMatchConsequence,
    PostMatchNextMatch,
    PostMatchRead,
    SwissConsequenceTeam,
} from './postMatchRead'

export type PostMatchMapState = 'decided' | 'live' | 'upcoming'

export interface PostMatchMapView {
    ordinal: number
    number: number
    map: string | null
    pickedBy: StreamSide | null
    caps: { a: number | null; b: number | null }
    winner: StreamSide | null
    state: PostMatchMapState
}

export interface ConsequenceLine {
    side: StreamSide
    team: string
    text: string
}

interface PostMatchSeriesView {
    teams: Record<StreamSide, string>
    series: { a: number; b: number }
    maps: PostMatchMapView[]
}

export type PostMatchView =
    | ({ phase: 'in-progress' } & PostMatchSeriesView)
    | ({ phase: 'result'; official: boolean; winner: StreamSide | null; consequence: ConsequenceLine[] } & PostMatchSeriesView)

const SIDES: readonly StreamSide[] = ['a', 'b']
const FINISHED_STATUSES: ReadonlySet<string> = new Set(['complete', 'forfeit', 'bye'])
const FALLBACK_NAMES: Record<StreamSide, string> = { a: 'Team A', b: 'Team B' }

type MatchContext = Pick<StreamMatch, 'stage' | 'round'>

function ordinalText(value: number): string {
    const tens = value % 100
    if (tens >= 11 && tens <= 13) return `${value}th`
    const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[value % 10] ?? 'th'
    return `${value}${suffix}`
}

function mapsOf(match: StreamMatch): PostMatchMapView[] {
    const slots = new Map(match.maps.map(slot => [slot.ordinal, slot]))
    return [...match.score.maps]
        .sort((left, right) => left.ordinal - right.ordinal)
        .map(score => {
            const slot = slots.get(score.ordinal)
            return {
                ordinal: score.ordinal,
                number: mapNumber(score.ordinal),
                map: slot?.map ?? null,
                pickedBy: slot?.picked_by ?? null,
                caps: score.caps,
                winner: score.winner,
                state: score.decided ? 'decided' : score.ordinal === match.score.current_map ? 'live' : 'upcoming',
            }
        })
}

function nextMatchTarget(next: PostMatchNextMatch, match: MatchContext): string {
    if (next.stage.key !== match.stage.key) return [`the ${next.stage.name}`, next.round.label].filter(Boolean).join(' · ')
    return `the ${next.round.label ?? next.stage.name}`
}

function bracketText(team: BracketConsequenceTeam, won: boolean, match: MatchContext): string {
    if (team.outcome === 'eliminated') return 'Eliminated'
    if (team.outcome === 'finished') return won ? `Wins the ${match.round.label ?? match.stage.name}` : 'Finished'
    if (team.next_match === null) return won ? 'Advances to the next round' : 'Plays on in the next round'
    return `${won ? 'Advances to' : 'Drops to'} ${nextMatchTarget(team.next_match, match)}`
}

function groupText(team: GroupConsequenceTeam, group: { name: string } | null): string {
    const where = group ? `in ${group.name}` : `of ${team.of}`
    return `${ordinalText(team.position)} ${where} on ${team.points} ${team.points === 1 ? 'pt' : 'pts'}`
}

function swissText(team: SwissConsequenceTeam): string {
    const record = `${team.wins}–${team.losses}`
    if (team.status === 'qualified') return `Qualified at ${record}`
    if (team.status === 'eliminated') return `Eliminated at ${record}`
    return `Now ${record} · plays on`
}

function consequenceText(consequence: PostMatchConsequence, side: StreamSide, match: MatchContext): string | null {
    const won = consequence.winner === side
    switch (consequence.kind) {
        case 'bracket': {
            const team = consequence.teams[side]
            return team && bracketText(team, won, match)
        }
        case 'group': {
            const team = consequence.teams[side]
            return team && groupText(team, consequence.group)
        }
        case 'swiss': {
            const team = consequence.teams[side]
            return team && swissText(team)
        }
    }
}

function consequenceLines(consequence: PostMatchConsequence | null, teams: Record<StreamSide, string>, match: MatchContext): ConsequenceLine[] {
    if (consequence === null) return []
    return SIDES.flatMap(side => {
        const text = consequenceText(consequence, side, match)
        return text === null ? [] : [{ side, team: teams[side], text }]
    })
}

export function isPostMatchDecided(score: StreamScore): boolean {
    return score.live_decided || score.winner !== null
}

export function isMatchFinished(match: Pick<StreamMatch, 'status'>): boolean {
    return FINISHED_STATUSES.has(match.status)
}

export function postMatchView(match: StreamMatch, read: PostMatchRead | null): PostMatchView {
    const { score } = match
    const teams = { a: match.teams.a?.name ?? FALLBACK_NAMES.a, b: match.teams.b?.name ?? FALLBACK_NAMES.b }
    const maps = mapsOf(match)
    const series = { a: score.series.a, b: score.series.b }

    if (!isPostMatchDecided(score)) return { phase: 'in-progress', teams, series, maps }

    const ownRead = read !== null && read.match_id === match.id ? read : null
    const readOfficial = ownRead?.official === true
    return {
        phase: 'result',
        official: readOfficial || isMatchFinished(match),
        winner: score.winner,
        teams,
        series,
        maps: maps.filter(map => map.state === 'decided'),
        consequence: readOfficial ? consequenceLines(ownRead.consequence, teams, match) : [],
    }
}
