import type {
    EventAdvancementRule, EventBracketGroup, EventBracketStage, EventBracketTeamRef, EventFormatSpec, EventPointsRow,
    EventGroupsConfig, EventMatch, EventSwissConfig,
} from '@/app/utils/api'
import { parseApiInstant } from '@/app/utils/timezone'
import { MATCH_STATUS_LABELS, isDecided, sideOf as slotOf, sortedMatches, teamLabel } from '@/app/components/pages/events/bracket/bracketShared'
import type { StreamMatch, StreamSide } from '../../data/streamHotState'
import { formatLabel, sceneTimeText } from '../../sceneHelpers'
import type { StandingsRead } from './standingsRead'

const DASH = '–'
const MINUS = '−'
const EMPTY_MESSAGE = 'This stage has not been drawn yet.'
const ALSO_TODAY_LIMIT = 4

export const MIN_BRACKET_SCALE = 0.7

const GROUP_ROWS_HEIGHT = 670
const GROUP_ROW_HEIGHT = 100
const GROUP_ROW_MIN_HEIGHT = 44
const GROUP_FONT_RATIO = 0.36
const GROUP_FONT_MIN = 18

const BRACKET_BOX_HEIGHT = 127
const BRACKET_BOX_GAP = 18
export const BRACKET_COLUMN_HEIGHT = 680
const BRACKET_BOX_WIDTH = 320
const BRACKET_ARROW_WIDTH = 72
const BRACKET_WIDTH = 1792

const SWISS_HEIGHT = 784
const SWISS_PANEL_CHROME = 110
const SWISS_COLUMN_GAP = 28
const SWISS_CENTRE_CHROME = 30
const SWISS_PATHS_HEIGHT = 94
export const SWISS_CHIPS = [
    { height: 68, gap: 12, font: 32 },
    { height: 52, gap: 8, font: 26 },
    { height: 40, gap: 6, font: 20 },
]
const SWISS_PAIRING_CHROME = 36

export type Tone = 'gold' | 'neutral' | 'out'

export interface StandingsTeam {
    id: string | null
    name: string
    side: StreamSide | null
}

export interface GroupRow {
    teamId: string
    name: string
    side: StreamSide | null
    zone: 'top' | 'next' | null
    rank: number
    seed: number | null
    played: number
    wins: number
    draws: number
    losses: number
    maps: string
    caps: string
    points: number
}

export interface GroupZone {
    label: string
    zone: 'top' | 'next'
}

export interface GroupFit {
    rowHeight: number
    fontSize: number
    scale: number
}

export interface GroupMatchLine {
    id: string
    a: string
    b: string
    score: { a: number; b: number } | null
    time: string
}

export interface GroupView {
    kind: 'groups'
    title: string
    kicker: string
    group: {
        name: string
        pointsRule: string | null
        showDraws: boolean
        rows: GroupRow[]
        fit: GroupFit
    }
    zones: GroupZone[]
    thisMatch: { a: string; b: string; time: string }
    alsoToday: GroupMatchLine[]
}

export interface SwissColumn {
    key: string
    record: string
    label: string
    tone: Tone
    teams: StandingsTeam[]
}

export interface SwissPairing {
    id: string
    a: StandingsTeam
    b: StandingsTeam
    current: boolean
    live: boolean
    score: { a: number; b: number } | null
    winner: 'a' | 'b' | null
}

export interface SwissCentre {
    record: string
    label: string
    line: string
    pairings: SwissPairing[]
}

export interface SwissPath {
    side: StreamSide
    name: string
    steps: string[]
}

export interface SwissView {
    kind: 'swiss'
    title: string
    kicker: string
    left: SwissColumn[]
    centre: SwissCentre | null
    right: SwissColumn[]
    paths: SwissPath[]
    density: number
    scale: number
}

export interface BracketLine {
    name: string
    side: StreamSide | null
    known: boolean
    score: number | null
    won: boolean
}

export interface BracketBox {
    id: string
    tag: string
    highlight: boolean
    current: boolean
    lines: [BracketLine, BracketLine]
}

export interface BracketRound {
    no: number
    label: string
    boxes: BracketBox[]
}

export interface BracketView {
    kind: 'bracket'
    title: string
    kicker: string
    rounds: BracketRound[]
    region: boolean
    scale: number
    footer: string
}

export interface EmptyView {
    kind: 'empty'
    title: string
    kicker: string
    message: string
}

export type StandingsView = GroupView | SwissView | BracketView | EmptyView

export interface StandingsViewInput {
    read: StandingsRead
    match: StreamMatch
    now: number
    format?: EventFormatSpec | null
}

type SideOf = (teamId: string | null | undefined) => StreamSide | null

function sideLookup(read: StandingsRead): SideOf {
    return teamId => {
        if (!teamId) return null
        if (read.team_ids.a === teamId) return 'a'
        if (read.team_ids.b === teamId) return 'b'
        return null
    }
}

function signed(value: number): string {
    if (value > 0) return `+${value}`
    if (value < 0) return `${MINUS}${-value}`
    return '0'
}

function pts(points: number): string {
    return `${points} ${points === 1 ? 'pt' : 'pts'}`
}

function ordinalText(value: number): string {
    const teen = value % 100 >= 11 && value % 100 <= 13
    const suffix = teen ? 'th' : value % 10 === 1 ? 'st' : value % 10 === 2 ? 'nd' : value % 10 === 3 ? 'rd' : 'th'
    return `${value}${suffix}`
}

function utcDay(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10)
}

function scoreOf(match: EventMatch): { a: number; b: number } | null {
    if (!isDecided(match) || match.score_a === null || match.score_b === null) return null
    return { a: match.score_a, b: match.score_b }
}

function roundName(roundNo: number, label?: string | null): string {
    return label || `Round ${roundNo}`
}

function upcomingText(entry: EventMatch, now: number): string | null {
    if (entry.status === 'live') return MATCH_STATUS_LABELS.live
    return sceneTimeText(entry.scheduled_at, now)
}

function hasTeam(match: EventMatch, teamId: string | null): boolean {
    return !!teamId && (match.team_a?.id === teamId || match.team_b?.id === teamId)
}

export function pointsRule(points: EventPointsRow[]): string | null {
    const scoring = points.filter(row => row.points > 0)
    if (scoring.length === 0) return null
    const wins = scoring.filter(row => row.maps_won > row.maps_lost)
    const others = scoring.filter(row => row.maps_won <= row.maps_lost)
    const winValues = new Set(wins.map(row => row.points))
    const allWins = points.filter(row => row.maps_won > row.maps_lost)
    const winText = wins.length > 0 && winValues.size === 1 && wins.length === allWins.length
        ? [`${pts(wins[0].points)} win`]
        : wins.map(row => `${pts(row.points)} ${row.maps_won}${DASH}${row.maps_lost}`)
    const otherText = others.map(row => `${pts(row.points)} ${row.maps_won}${DASH}${row.maps_lost}${row.maps_won === row.maps_lost ? ' draw' : ''}`)
    return [...winText, ...otherText].join(' · ')
}

export function groupFit(rowCount: number): GroupFit {
    const rows = Math.max(rowCount, 1)
    const rowHeight = Math.max(GROUP_ROW_MIN_HEIGHT, Math.min(GROUP_ROW_HEIGHT, Math.floor(GROUP_ROWS_HEIGHT / rows)))
    const fontSize = Math.max(GROUP_FONT_MIN, Math.round(rowHeight * GROUP_FONT_RATIO))
    const scale = Math.min(1, GROUP_ROWS_HEIGHT / (rowHeight * rows))
    return { rowHeight, fontSize, scale }
}

function stageMatchOf(stage: EventBracketStage, matchId: string): EventMatch | null {
    return stage.matches.find(match => match.id === matchId) ?? null
}

function matchRound(stage: EventBracketStage, read: StandingsRead, match: StreamMatch): number | null {
    return stageMatchOf(stage, read.match_id)?.round_no ?? match.round.no
}

function groupOf(stage: EventBracketStage, read: StandingsRead): EventBracketGroup | null {
    const named = stage.groups.find(group => group.id === read.group_id)
    if (named) return named
    const holding = (teamId: string | null) => stage.groups.find(group => group.standings.some(row => row.team_id === teamId))
    return holding(read.team_ids.a) ?? holding(read.team_ids.b) ?? stage.groups[0] ?? null
}

function roundProgress(groupMatches: EventMatch[], round: number | null, groupName: string): string {
    if (round === null) return groupName
    const inRound = groupMatches.filter(match => match.round_no === round)
    const decided = inRound.filter(isDecided)
    if (decided.length === 0) return `${groupName} · before round ${round}`
    if (decided.length < inRound.length) return `${groupName} · after round ${round} so far`
    return `${groupName} · after round ${round}`
}

function rankRange(rule: EventAdvancementRule): [number, number] | null {
    if (rule.from_rank === undefined && rule.to_rank === undefined) return null
    const from = rule.from_rank ?? 1
    return [from, rule.to_rank ?? from]
}

function groupZones(stage: EventBracketStage, format: EventFormatSpec | null | undefined): { zones: GroupZone[]; zoneOf: (rank: number) => 'top' | 'next' | null } {
    const stages = format?.stages ?? []
    const rules = stages.find(entry => entry.key === stage.key)?.advancement ?? []
    const ranged = rules
        .map(rule => ({ rule, range: rankRange(rule) }))
        .filter((entry): entry is { rule: EventAdvancementRule; range: [number, number] } => entry.range !== null)
        .sort((a, b) => a.range[0] - b.range[0])
    const zones = ranged.map(({ rule, range }, index): GroupZone => {
        const destination = rule.label || stages.find(entry => entry.key === rule.to_stage)?.name || rule.to_stage
        const ranks = range[0] === range[1] ? ordinalText(range[0]) : `${ordinalText(range[0])}${DASH}${ordinalText(range[1])}`
        return { label: `${ranks} · ${destination}`, zone: index === 0 ? 'top' : 'next' }
    })
    const zoneOf = (rank: number) => {
        const index = ranged.findIndex(({ range }) => rank >= range[0] && rank <= range[1])
        if (index < 0) return null
        return index === 0 ? 'top' : 'next'
    }
    return { zones, zoneOf }
}

function thisMatchTime(match: StreamMatch, now: number): string {
    if (match.status === 'live') return 'Live now'
    return sceneTimeText(match.scheduled_at, now) ?? 'Not scheduled'
}

function groupView(stage: EventBracketStage, input: StandingsViewInput): GroupView | EmptyView {
    const { read, match, now, format } = input
    const group = groupOf(stage, read)
    if (!group) return emptyView('Standings', stage.name)

    const sideOf = sideLookup(read)
    const config = stage.config as EventGroupsConfig | null
    const points = config?.points ?? []
    const groupMatches = stage.matches.filter(entry => entry.group_id === group.id)
    const { zones, zoneOf } = groupZones(stage, format)

    const rows = group.standings.map((row): GroupRow => ({
        teamId: row.team_id,
        name: teamLabel(row.team),
        side: sideOf(row.team_id),
        zone: zoneOf(row.rank),
        rank: row.rank,
        seed: row.seed,
        played: row.played,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        maps: `${row.maps_won}${DASH}${row.maps_lost}`,
        caps: signed(row.caps_diff),
        points: row.points,
    }))

    const today = utcDay(now)
    const alsoToday = groupMatches
        .filter(entry => entry.id !== read.match_id)
        .map(entry => ({ entry, at: parseApiInstant(entry.scheduled_at) }))
        .filter((row): row is { entry: EventMatch; at: number } => row.at !== null && utcDay(row.at) === today)
        .sort((a, b) => Math.abs(a.at - now) - Math.abs(b.at - now))
        .slice(0, ALSO_TODAY_LIMIT)
        .sort((a, b) => a.at - b.at || a.entry.ordinal - b.entry.ordinal)
        .map(({ entry }): GroupMatchLine => ({
            id: entry.id,
            a: teamLabel(entry.team_a, entry.slot_a_label),
            b: teamLabel(entry.team_b, entry.slot_b_label),
            score: scoreOf(entry),
            time: upcomingText(entry, now) ?? '',
        }))

    return {
        kind: 'groups',
        title: 'Standings',
        kicker: roundProgress(groupMatches, matchRound(stage, read, match), group.name),
        group: {
            name: group.name,
            pointsRule: pointsRule(points),
            showDraws: points.some(row => row.maps_won === row.maps_lost) || rows.some(row => row.draws > 0),
            rows,
            fit: groupFit(rows.length),
        },
        zones,
        thisMatch: {
            a: match.teams.a?.name ?? 'TBD',
            b: match.teams.b?.name ?? 'TBD',
            time: thisMatchTime(match, now),
        },
        alsoToday,
    }
}

interface SwissRecord {
    wins: number
    losses: number
}

function recordText({ wins, losses }: SwissRecord): string {
    return `${wins}${DASH}${losses}`
}

function recordRank(record: SwissRecord): number {
    return (record.wins - record.losses) * 1000 + record.wins
}

function recordBefore(stage: EventBracketStage, teamId: string | null, round: number): SwissRecord {
    const record = { wins: 0, losses: 0 }
    for (const entry of stage.matches) {
        if (entry.round_no >= round || !isDecided(entry) || !hasTeam(entry, teamId) || !entry.winner_team_id) continue
        if (entry.winner_team_id === teamId) record.wins += 1
        else record.losses += 1
    }
    return record
}

function bucketLabel(record: SwissRecord, config: { win: number; lose: number }): { label: string; consequence: string | null } {
    const qualifies = record.wins === config.win - 1
    const eliminates = record.losses === config.lose - 1
    if (qualifies && eliminates) return { label: 'Decider round', consequence: 'winners qualify, losers are out' }
    if (qualifies) return { label: 'Qualification round', consequence: 'winners qualify' }
    if (eliminates) return { label: 'Elimination round', consequence: 'losers are out' }
    return { label: 'In contention', consequence: null }
}

function chip(team: EventBracketTeamRef | null, sideOf: SideOf, fallback?: string | null): StandingsTeam {
    return { id: team?.id ?? null, name: teamLabel(team, fallback), side: sideOf(team?.id) }
}

function pairingOf(entry: EventMatch, sideOf: SideOf, current: boolean): SwissPairing {
    const a = chip(entry.team_a, sideOf, entry.slot_a_label)
    const b = chip(entry.team_b, sideOf, entry.slot_b_label)
    const score = scoreOf(entry)
    const winner = slotOf(entry, entry.winner_team_id)
    const live = entry.status === 'live'
    if (current && a.side === 'b') {
        return {
            id: entry.id,
            a: b,
            b: a,
            current,
            live,
            score: score && { a: score.b, b: score.a },
            winner: winner && (winner === 'a' ? 'b' : 'a'),
        }
    }
    return { id: entry.id, a, b, current, live, score, winner }
}

function pathStep(entry: EventMatch, teamId: string): string {
    const own = entry.team_a?.id === teamId ? 'a' : 'b'
    const opponent = own === 'a' ? entry.team_b : entry.team_a
    const result = entry.winner_team_id === null ? 'D' : entry.winner_team_id === teamId ? 'W' : 'L'
    const score = scoreOf(entry)
    const scoreText = score ? ` ${own === 'a' ? score.a : score.b}${DASH}${own === 'a' ? score.b : score.a}` : ''
    return `${result}${scoreText} vs ${teamLabel(opponent)}`
}

function swissFit(sides: SwissColumn[][], centre: SwissCentre | null): { density: number; scale: number } {
    const heightAt = (density: number) => {
        const { height, gap } = SWISS_CHIPS[density]
        const sideHeight = (columns: SwissColumn[]) => columns.reduce((sum, column) => sum + SWISS_PANEL_CHROME + column.teams.length * (height + gap), 0)
            + Math.max(columns.length - 1, 0) * SWISS_COLUMN_GAP
        const centreHeight = centre
            ? SWISS_PANEL_CHROME + SWISS_CENTRE_CHROME + centre.pairings.length * (height + SWISS_PAIRING_CHROME) + SWISS_PATHS_HEIGHT
            : 0
        return Math.max(centreHeight, ...sides.map(sideHeight))
    }
    for (let density = 0; density < SWISS_CHIPS.length; density += 1) {
        if (heightAt(density) <= SWISS_HEIGHT) return { density, scale: 1 }
    }
    const densest = SWISS_CHIPS.length - 1
    return { density: densest, scale: SWISS_HEIGHT / heightAt(densest) }
}

function swissView(stage: EventBracketStage, input: StandingsViewInput): SwissView | EmptyView {
    const { read, match } = input
    const kicker = `${stage.name} · Swiss`
    if (stage.entrants.length === 0) return emptyView('Standings', kicker)

    const sideOf = sideLookup(read)
    const config = stage.config as EventSwissConfig | null
    const limits = { win: config?.wins_to_qualify ?? 2, lose: config?.losses_to_eliminate ?? 2 }
    const current = stageMatchOf(stage, read.match_id)

    let centre: SwissCentre | null = null
    const inCentre = new Set<string>()
    let centreRecord: SwissRecord | null = null
    if (current) {
        const anchor = current.team_a?.id ?? current.team_b?.id ?? null
        centreRecord = recordBefore(stage, anchor, current.round_no)
        const record = centreRecord
        const pairings = sortedMatches(stage)
            .filter(entry => entry.round_no === current.round_no && entry.status !== 'bye')
            .filter(entry => entry.id === current.id || [entry.team_a?.id, entry.team_b?.id].some(teamId => {
                if (!teamId) return false
                const before = recordBefore(stage, teamId, current.round_no)
                return before.wins === record.wins && before.losses === record.losses
            }))
            .sort((a, b) => Number(b.id === current.id) - Number(a.id === current.id))
            .map(entry => pairingOf(entry, sideOf, entry.id === current.id))
        for (const pairing of pairings) {
            if (pairing.a.id) inCentre.add(pairing.a.id)
            if (pairing.b.id) inCentre.add(pairing.b.id)
        }
        const { label, consequence } = bucketLabel(record, limits)
        const roundLine = roundName(current.round_no, current.round_label)
        centre = {
            record: recordText(record),
            label,
            line: consequence ? `${roundLine} · ${consequence}` : roundLine,
            pairings,
        }
    }

    const rest = stage.entrants.filter(entrant => !inCentre.has(entrant.team_id))
    const statusColumn = (status: 'qualified' | 'eliminated', label: string, tone: Tone): SwissColumn | null => {
        const entrants = rest.filter(entrant => entrant.status === status)
        if (entrants.length === 0) return null
        const records = [...new Set(entrants.map(recordText))]
        return {
            key: status,
            record: records.join('/'),
            label,
            tone,
            teams: entrants.map(entrant => chip(entrant.team, sideOf)),
        }
    }
    const buckets = new Map<string, SwissRecord>()
    for (const entrant of rest) {
        if (entrant.status === 'active') buckets.set(recordText(entrant), { wins: entrant.wins, losses: entrant.losses })
    }
    const active = [...buckets.values()]
        .sort((a, b) => recordRank(b) - recordRank(a))
        .map((record): SwissColumn => ({
            key: recordText(record),
            record: recordText(record),
            label: bucketLabel(record, limits).label,
            tone: 'neutral',
            teams: rest
                .filter(entrant => entrant.status === 'active' && entrant.wins === record.wins && entrant.losses === record.losses)
                .map(entrant => chip(entrant.team, sideOf)),
        }))
    const ahead = (record: SwissRecord) => centreRecord === null || recordRank(record) >= recordRank(centreRecord)
    const byRecord = (column: SwissColumn) => {
        const [wins, losses] = column.record.split(DASH).map(Number)
        return { wins, losses }
    }
    const qualified = statusColumn('qualified', 'Qualified', 'gold')
    const eliminated = statusColumn('eliminated', 'Eliminated', 'out')
    const left = [qualified, ...active.filter(column => ahead(byRecord(column)))].filter((column): column is SwissColumn => column !== null)
    const right = [...active.filter(column => !ahead(byRecord(column))), eliminated].filter((column): column is SwissColumn => column !== null)

    const paths = (['a', 'b'] as const).flatMap((side): SwissPath[] => {
        const teamId = read.team_ids[side]
        const team = match.teams[side]
        if (!teamId || !team) return []
        const steps = sortedMatches(stage)
            .filter(entry => entry.id !== read.match_id && isDecided(entry) && entry.status !== 'bye' && hasTeam(entry, teamId))
            .filter(entry => !current || entry.round_no < current.round_no)
            .map(entry => pathStep(entry, teamId))
        return [{ side, name: team.name, steps }]
    })

    return {
        kind: 'swiss',
        title: 'Standings',
        kicker,
        left,
        centre,
        right,
        paths,
        ...swissFit([left, right], centre),
    }
}

export function bracketFit(roundSizes: number[]): number {
    const tallest = Math.max(...roundSizes, 1)
    const columnHeight = tallest * BRACKET_BOX_HEIGHT + (tallest - 1) * BRACKET_BOX_GAP
    const columns = Math.max(roundSizes.length, 1)
    const width = columns * BRACKET_BOX_WIDTH + (columns - 1) * BRACKET_ARROW_WIDTH
    return Math.min(1, BRACKET_COLUMN_HEIGHT / columnHeight, BRACKET_WIDTH / width)
}

function roundLabels(stage: EventBracketStage): Map<number, string> {
    const labels = new Map<number, string>()
    for (const entry of sortedMatches(stage)) {
        if (!labels.has(entry.round_no) || (entry.round_label && labels.get(entry.round_no) === roundName(entry.round_no))) {
            labels.set(entry.round_no, roundName(entry.round_no, entry.round_label))
        }
    }
    return labels
}

function feedersOf(stage: EventBracketStage, matchId: string): EventMatch[] {
    return stage.matches.filter(entry => entry.winner_to_match_id === matchId)
}

function subtree(stage: EventBracketStage, rootId: string): Set<string> {
    const ids = new Set<string>([rootId])
    const queue = [rootId]
    while (queue.length > 0) {
        const id = queue.shift() as string
        for (const feeder of feedersOf(stage, id)) {
            if (ids.has(feeder.id)) continue
            ids.add(feeder.id)
            queue.push(feeder.id)
        }
    }
    return ids
}

function ancestry(stage: EventBracketStage, matchId: string): string[] {
    const chain = [matchId]
    let next = stageMatchOf(stage, matchId)?.winner_to_match_id ?? null
    while (next && !chain.includes(next)) {
        chain.push(next)
        next = stageMatchOf(stage, next)?.winner_to_match_id ?? null
    }
    return chain
}

function bracketBox(entry: EventMatch, context: { currentId: string; destinationId: string | null; sideOf: SideOf; teamIds: (string | null)[]; now: number }): BracketBox {
    const { currentId, destinationId, sideOf, teamIds, now } = context
    const current = entry.id === currentId
    const score = scoreOf(entry)
    const line = (team: EventBracketTeamRef | null, label: string | null, slot: 'a' | 'b'): BracketLine => ({
        name: teamLabel(team, label),
        side: sideOf(team?.id),
        known: !!team,
        score: score ? score[slot] : null,
        won: !!team && entry.winner_team_id === team.id,
    })
    const tag = current
        ? entry.status === 'live' ? 'Live · this match' : 'This match'
        : entry.id === destinationId
            ? 'Winner goes here'
            : isDecided(entry) || entry.status === 'cancelled'
                ? MATCH_STATUS_LABELS[entry.status]
                : upcomingText(entry, now) ?? 'Not scheduled'
    return {
        id: entry.id,
        tag,
        current,
        highlight: current || entry.id === destinationId || teamIds.some(teamId => hasTeam(entry, teamId)),
        lines: [line(entry.team_a, entry.slot_a_label, 'a'), line(entry.team_b, entry.slot_b_label, 'b')],
    }
}

function regionName(depth: number): string {
    if (depth === 1) return 'Their half of the bracket'
    if (depth === 2) return 'Their quarter of the bracket'
    return 'Their part of the bracket'
}

function bracketView(stage: EventBracketStage, input: StandingsViewInput): BracketView | EmptyView {
    const { read, match, now } = input
    const kicker = `${stage.name} · single elimination`
    const shown = sortedMatches(stage).filter(entry => entry.status !== 'bye')
    if (shown.length === 0) return emptyView('Bracket', kicker)

    const labels = roundLabels(stage)
    const current = stageMatchOf(stage, read.match_id)
    const sideOf = sideLookup(read)
    const teamIds = [read.team_ids.a, read.team_ids.b]

    const roundsOf = (ids: Set<string> | null): BracketRound[] => {
        const byRound = new Map<number, EventMatch[]>()
        for (const entry of shown) {
            if (ids && !ids.has(entry.id)) continue
            byRound.set(entry.round_no, [...(byRound.get(entry.round_no) ?? []), entry])
        }
        return [...byRound.entries()]
            .sort(([a], [b]) => a - b)
            .map(([no, entries]) => ({
                no,
                label: labels.get(no) ?? roundName(no),
                boxes: entries.map(entry => bracketBox(entry, {
                    currentId: read.match_id,
                    destinationId: current?.winner_to_match_id ?? null,
                    sideOf,
                    teamIds,
                    now,
                })),
            }))
    }
    const sizesOf = (rounds: BracketRound[]) => rounds.map(round => round.boxes.length)

    let rounds = roundsOf(null)
    let scale = bracketFit(sizesOf(rounds))
    let depth = 0
    if (current && scale < MIN_BRACKET_SCALE) {
        const chain = ancestry(stage, current.id)
        for (let index = chain.length - 2; index >= 0; index -= 1) {
            const ids = subtree(stage, chain[index])
            for (const later of chain.slice(index + 1)) ids.add(later)
            rounds = roundsOf(ids)
            scale = bracketFit(sizesOf(rounds))
            depth = chain.length - 1 - index
            if (scale >= MIN_BRACKET_SCALE) break
        }
    }

    const cameIn = (side: StreamSide): string | null => {
        const teamId = read.team_ids[side]
        const team = match.teams[side]
        if (!current || !teamId || !team) return null
        const feeder = feedersOf(stage, current.id).find(entry => hasTeam(entry, teamId))
        if (!feeder) return null
        if (feeder.status === 'bye') return `${team.name} came in with a bye`
        if (isDecided(feeder) && feeder.winner_team_id === teamId) return `${team.name} won in the ${labels.get(feeder.round_no) ?? roundName(feeder.round_no)}`
        return null
    }

    const footer = [cameIn('a'), cameIn('b'), formatLabel(match), depth > 0 ? regionName(depth) : null]
        .filter((part): part is string => !!part)
        .join(' · ')

    return { kind: 'bracket', title: 'Bracket', kicker, rounds, region: depth > 0, scale, footer }
}

function emptyView(title: string, kicker: string): EmptyView {
    return { kind: 'empty', title, kicker, message: EMPTY_MESSAGE }
}

export function standingsView(input: StandingsViewInput): StandingsView {
    const stage = input.read.stage
    if (stage.kind === 'groups') return groupView(stage, input)
    if (stage.kind === 'swiss') return swissView(stage, input)
    return bracketView(stage, input)
}
