import type { RawActiveTitle } from '@/app/utils/api'
import { formatOdds, formatPercent } from '@/app/components/pages/events/predictions/predictionsShared'
import { sceneTimeText } from '../../sceneHelpers'
import type { StreamSide } from '../../data/streamHotState'
import type {
    PreviewCupRunEntry,
    PreviewEliminationView,
    PreviewGroupsView,
    PreviewInsights,
    PreviewMember,
    PreviewOdds,
    PreviewOutcome,
    PreviewStageMatch,
    PreviewStageView,
    PreviewSwissView,
    PreviewTeam,
    StreamPreview,
} from './previewRead'

export type ResultLetter = 'W' | 'D' | 'L'

export const PREVIEW_SIDES: readonly StreamSide[] = ['a', 'b']
const CUP_RUN_LIMIT = 3
const FORM_LENGTH = 5

const LINEUP_SIZE = 2
const DASH = '–'

export interface PreviewPlayerView {
    id: string
    name: string | null
    title: RawActiveTitle | null
    careerCaps: string
    wrs: string
    wrSplit: string
    cupCaps: string
}

export interface CupRunChip {
    matchId: string
    round: string
    result: ResultLetter | null
    score: string
    opponent: string
}

export interface PreviewTeamView {
    side: StreamSide
    name: string
    stageSeed: number | null
    preCupSeed: number | null
    odds: string | null
    players: PreviewPlayerView[]
    cupRun: { shown: CupRunChip[]; earlier: number }
    form: (ResultLetter | null)[]
}

export interface GroupRowView {
    key: string
    rank: number
    name: string
    side: StreamSide | null
    record: string
    maps: string
    points: number
}

export interface SwissBucketView {
    key: string
    label: string
    status: 'active' | 'qualified' | 'eliminated'
    count: number
    marked: { side: StreamSide; name: string }[]
}

export interface PathStepView {
    matchId: string
    round: string
    current: boolean
    result: ResultLetter | null
    score: string | null
    opponent: string
}

export interface NextStepView {
    matchId: string
    round: string
    waiting: string | null
}

export type PreviewStageViewModel =
    | { kind: 'groups'; title: string; rows: GroupRowView[] }
    | { kind: 'swiss'; title: string; rule: string; buckets: SwissBucketView[] }
    | { kind: 'single_elim'; title: string; names: Record<StreamSide, string>; paths: Record<StreamSide, PathStepView[]>; winnerPath: NextStepView[] }
    | { kind: 'none'; title: string }

export interface HeadToHeadView {
    meetings: string
    wins: Record<StreamSide, number>
    draws: number
    last: string | null
    lastResult: string | null
}

export interface OddsPriceView {
    percent: string
    odds: string
    share: number
}

export interface OddsView {
    a: OddsPriceView
    b: OddsPriceView
    draw: OddsPriceView | null
    totals: string
    note: string
}

export interface PreviewViewModel {
    kicker: string | null
    teams: Record<StreamSide, PreviewTeamView | null>
    stageView: PreviewStageViewModel
    headToHead: HeadToHeadView | null
    odds: OddsView | null
}

const RESULT_LETTERS: Record<PreviewOutcome, ResultLetter> = { win: 'W', draw: 'D', loss: 'L' }

function count(value: number): string {
    return value.toLocaleString('en-US')
}

function plural(value: number, one: string, many: string): string {
    return `${count(value)} ${value === 1 ? one : many}`
}

function pair(left: number | null, right: number | null): string {
    return `${left ?? 0}${DASH}${right ?? 0}`
}

function resultLetter(outcome: PreviewOutcome | null): ResultLetter | null {
    return outcome === null ? null : RESULT_LETTERS[outcome]
}

function roundText(round: { no: number | null; label: string | null }): string {
    const numbered = round.label ? /^Round (\d+)$/.exec(round.label) : null
    if (numbered) return `R${numbered[1]}`
    if (round.label) return round.label
    return round.no === null ? '' : `R${round.no}`
}

function lineupPlayers(team: PreviewTeam, ids: (string | null)[]): PreviewMember[] {
    const picked: PreviewMember[] = []
    const add = (member: PreviewMember | undefined) => {
        if (member && !picked.includes(member) && picked.length < LINEUP_SIZE) picked.push(member)
    }
    ids.forEach(id => add(team.members.find(member => member.id === id)))
    team.members.forEach(add)
    return picked
}

function playerView(member: PreviewMember): PreviewPlayerView {
    return {
        id: member.id,
        name: member.display_name || null,
        title: member.title,
        careerCaps: count(member.career_caps),
        wrs: count(member.wr_count),
        wrSplit: `${count(member.solo_wrs)} solo · ${count(member.team_wrs)} team`,
        cupCaps: count(member.cup_caps),
    }
}

function cupRunChip(entry: PreviewCupRunEntry): CupRunChip {
    return {
        matchId: entry.match_id,
        round: roundText(entry.round),
        result: resultLetter(entry.result),
        score: entry.status === 'forfeit' ? 'FF' : pair(entry.score.for, entry.score.against),
        opponent: entry.opponent?.name ?? 'TBD',
    }
}

function formOf(insights: PreviewInsights, side: StreamSide): (ResultLetter | null)[] {
    const latestFirst = insights.teams?.[side]?.form ?? []
    const letters = latestFirst.slice(0, FORM_LENGTH).reverse().map(entry => resultLetter(entry.outcome))
    return Array.from({ length: FORM_LENGTH }, (_, index) => letters[index] ?? null)
}

function teamView(preview: StreamPreview, side: StreamSide, odds: OddsView | null): PreviewTeamView | null {
    const team = preview.teams[side]
    if (!team) return null
    const run = team.cup_run.map(cupRunChip)
    const shown = run.slice(-CUP_RUN_LIMIT)
    const price = odds?.[side]
    return {
        side,
        name: team.name,
        stageSeed: team.stage_seed,
        preCupSeed: team.pre_cup_seed,
        odds: price ? `${price.percent} · ${price.odds}` : null,
        players: lineupPlayers(team, [preview.lineup[`${side}1`], preview.lineup[`${side}2`]]).map(playerView),
        cupRun: { shown, earlier: run.length - shown.length },
        form: formOf(preview.insights, side),
    }
}

function groupsView(view: PreviewGroupsView): PreviewStageViewModel {
    return {
        kind: 'groups',
        title: `${view.group?.name ?? view.stage.name} standings`,
        rows: view.rows.map(row => ({
            key: row.team_id,
            rank: row.rank,
            name: row.team.name,
            side: row.side,
            record: [row.wins, row.draws, row.losses].join(DASH),
            maps: pair(row.maps_won, row.maps_lost),
            points: row.points,
        })),
    }
}

function swissView(view: PreviewSwissView): PreviewStageViewModel {
    const buckets = new Map<string, SwissBucketView & { wins: number; losses: number }>()
    for (const row of view.rows) {
        const key = row.status === 'active' ? `${row.wins}-${row.losses}` : row.status
        const label = row.status === 'qualified' ? 'Qualified' : row.status === 'eliminated' ? 'Eliminated' : pair(row.wins, row.losses)
        const bucket = buckets.get(key) ?? { key, label, status: row.status, count: 0, marked: [], wins: row.wins, losses: row.losses }
        bucket.count += 1
        if (row.side) bucket.marked.push({ side: row.side, name: row.team.name })
        buckets.set(key, bucket)
    }
    const order = (bucket: { status: SwissBucketView['status'] }) => ({ qualified: 0, active: 1, eliminated: 2 })[bucket.status]
    const sorted = [...buckets.values()].sort((x, y) => order(x) - order(y) || y.wins - x.wins || x.losses - y.losses)
    const rule = [
        view.round.label ?? (view.round.no === null ? null : `Round ${view.round.no}`),
        plural(view.wins_to_qualify, 'win qualifies', 'wins qualify'),
        plural(view.losses_to_eliminate, 'loss out', 'losses out'),
    ].filter(Boolean).join(' · ')
    return {
        kind: 'swiss',
        title: `${view.stage.name} · Swiss`,
        rule,
        buckets: sorted.map(({ key, label, status, count: size, marked }) => ({ key, label, status, count: size, marked })),
    }
}

function pathStep(match: PreviewStageMatch, side: StreamSide): PathStepView {
    const ownIndex = match.slots.findIndex(slot => slot.side === side)
    const own = match.slots[ownIndex]
    const other = match.slots[1 - ownIndex]
    const decided = match.is_draw || own.winner || other.winner
    const result: ResultLetter | null = match.is_draw ? 'D' : own.winner ? 'W' : other.winner ? 'L' : null
    return {
        matchId: match.id,
        round: match.round.label ?? roundText(match.round),
        current: match.current,
        result,
        score: match.status === 'forfeit' ? 'FF' : decided ? pair(own.score, other.score) : null,
        opponent: other.team?.name ?? other.label ?? 'TBD',
    }
}

function nextStep(match: PreviewStageMatch): NextStepView {
    const seated = match.slots.filter(slot => slot.team !== null)
    return {
        matchId: match.id,
        round: match.round.label ?? roundText(match.round),
        waiting: seated.length === 1 && seated[0].side === null ? seated[0].team?.name ?? null : null,
    }
}

function eliminationView(view: PreviewEliminationView, teams: StreamPreview['teams']): PreviewStageViewModel {
    const matches = new Map(view.rounds.flatMap(round => round.matches).map(match => [match.id, match]))
    const stepsOf = (side: StreamSide) =>
        view.path[side].flatMap(id => {
            const match = matches.get(id)
            return match && match.slots.some(slot => slot.side === side) ? [pathStep(match, side)] : []
        })
    return {
        kind: 'single_elim',
        title: `${view.stage.name} · Bracket path`,
        names: { a: teams.a?.name ?? 'TBD', b: teams.b?.name ?? 'TBD' },
        paths: { a: stepsOf('a'), b: stepsOf('b') },
        winnerPath: view.winner_path.flatMap(id => {
            const match = matches.get(id)
            return match ? [nextStep(match)] : []
        }),
    }
}

function stageViewOf(view: PreviewStageView, teams: StreamPreview['teams']): PreviewStageViewModel {
    if (view.kind === 'groups') return groupsView(view as PreviewGroupsView)
    if (view.kind === 'swiss') return swissView(view as PreviewSwissView)
    if (view.kind === 'single_elim') return eliminationView(view as PreviewEliminationView, teams)
    return { kind: 'none', title: view.stage.name }
}

function headToHeadOf(preview: StreamPreview, now: number): HeadToHeadView | null {
    const { a, b } = preview.teams
    if (!a || !b) return null
    const history = preview.insights.head_to_head
    const played = history?.played ?? 0
    const last = history?.matches[0]
    const lastWhen = last ? sceneTimeText(last.scheduled_at, now) ?? [last.stage, last.round_label].filter(Boolean).join(' · ') : null
    const lastResult = !last
        ? null
        : last.outcome === 'win'
            ? `${a.name} won ${pair(last.score, last.opponent_score)}`
            : last.outcome === 'loss'
                ? `${b.name} won ${pair(last.opponent_score, last.score)}`
                : last.outcome === 'draw'
                    ? `Drawn ${pair(last.score, last.opponent_score)}`
                    : pair(last.score, last.opponent_score)
    return {
        meetings: played === 0 ? 'First meeting' : plural(played, 'meeting', 'meetings'),
        wins: { a: history?.record.win ?? 0, b: history?.record.loss ?? 0 },
        draws: history?.record.draw ?? 0,
        last: lastWhen ? `Last: ${lastWhen}` : null,
        lastResult,
    }
}

function oddsNote(odds: PreviewOdds): string {
    return odds.status === 'open' ? 'The market closes when Picks & Bans start.' : 'Predictions are closed.'
}

function oddsOf(preview: StreamPreview): OddsView | null {
    const odds = preview.odds
    if (!preview.predictions_enabled || !odds || odds.status === 'voided') return null
    const { a, b, draw } = odds.price
    if (a === null || b === null) return null
    const total = a + b + (draw ?? 0)
    const priceView = (price: number): OddsPriceView => ({ percent: formatPercent(price), odds: formatOdds(price), share: total > 0 ? price / total : 0 })
    return {
        a: priceView(a),
        b: priceView(b),
        draw: draw === null ? null : priceView(draw),
        totals: `${plural(odds.position_count, 'prediction', 'predictions')} · ${count(odds.pool_stake)} coins in the pool`,
        note: oddsNote(odds),
    }
}

export function previewView({ preview, startsAt, now }: { preview: StreamPreview; startsAt: string | null; now: number }): PreviewViewModel {
    const odds = oddsOf(preview)
    return {
        kicker: sceneTimeText(startsAt, now),
        teams: { a: teamView(preview, 'a', odds), b: teamView(preview, 'b', odds) },
        stageView: stageViewOf(preview.stage_view, preview.teams),
        headToHead: headToHeadOf(preview, now),
        odds,
    }
}
