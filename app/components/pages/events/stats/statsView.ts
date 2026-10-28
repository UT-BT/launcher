import type { ResponsiveColumn } from '@/app/components/shared/DataTable'
import { formatCapTime } from '@/app/utils/format'
import { sideColorTag } from '@/app/utils/sideLabels'
import {
    ApiError,
    type EventRun,
    type EventStatsFormEntry,
    type EventStatsMap,
    type EventStatsPathEntry,
    type EventStatsRecordsHeld,
    type EventStatsResult,
    type EventStatsStage,
    type EventStatsStanding,
    type EventStatsTeam,
    type EventStatsTeamMember,
    type EventStatsWdl,
    type EventTeamMapProfileRow,
    type EventTeamStats,
    type EventTeamStatsMap,
    type EventTeamStatsMatch,
    type EventTeamStatsOpponent,
} from '@/app/utils/api'

export type StatsMode = 'roster' | 'stats'

export function statsMode(source: { published: boolean } | null | undefined): StatsMode {
    return source?.published ? 'stats' : 'roster'
}

export interface StageChip {
    key: string | null
    label: string
    active: boolean
}

export function stageChips(stages: EventStatsStage[], selected: string | null): StageChip[] {
    const current = selected || null
    return [
        { key: null, label: 'All', active: current === null },
        ...stages.map(stage => ({ key: stage.key, label: stage.name, active: stage.key === current })),
    ]
}

export function stageScopeLabel(stages: EventStatsStage[], selected: string | null): string {
    return stages.find(stage => stage.key === selected)?.name ?? 'All stages'
}

export type TeamSortKey = 'standing' | 'seed' | 'record' | 'caps'

export const TEAM_SORTS: readonly { key: TeamSortKey; label: string }[] = [
    { key: 'standing', label: 'Standing' },
    { key: 'seed', label: 'Seed' },
    { key: 'record', label: 'Record' },
    { key: 'caps', label: 'Caps' },
]

export const DEFAULT_TEAM_SORT: TeamSortKey = 'standing'

type Comparator = (a: EventStatsTeam, b: EventStatsTeam) => number

function recordScore(team: EventStatsTeam): number[] {
    const { matches, maps, caps } = team.record
    return [matches.w * 3 + matches.d, maps.w - maps.l, caps.for - caps.against]
}

function compareScores(a: number[], b: number[]): number {
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return a[i] - b[i]
    }
    return 0
}

function bySeed(a: { seed: number | null; name: string }, b: { seed: number | null; name: string }): number {
    if (a.seed !== b.seed) {
        if (a.seed === null) return 1
        if (b.seed === null) return -1
        return a.seed - b.seed
    }
    return a.name.localeCompare(b.name)
}

const byRecord: Comparator = (a, b) => compareScores(recordScore(b), recordScore(a))

const TEAM_COMPARATORS: Record<TeamSortKey, Comparator> = {
    standing: (a, b) =>
        Number(b.standing === 'champion') - Number(a.standing === 'champion')
        || b.furthest_stage.order - a.furthest_stage.order
        || byRecord(a, b)
        || bySeed(a, b),
    seed: bySeed,
    record: (a, b) => byRecord(a, b) || bySeed(a, b),
    caps: (a, b) => b.record.caps.for - a.record.caps.for || a.record.caps.against - b.record.caps.against || bySeed(a, b),
}

export function sortTeams<T extends EventStatsTeam>(teams: readonly T[], key: TeamSortKey): T[] {
    return [...teams].sort(TEAM_COMPARATORS[key])
}

export const ACCENT_SLOT_COUNT = 12

export interface AccentTeam {
    id: string
    name: string
    seed: number | null
}

export function accentSlots(teams: readonly AccentTeam[]): Record<string, number> {
    const slots: Record<string, number> = {}
    let lastSeed = 0
    for (const team of teams) {
        if (team.seed === null) continue
        slots[team.id] = (team.seed - 1) % ACCENT_SLOT_COUNT
        lastSeed = Math.max(lastSeed, team.seed)
    }
    const unseeded = teams.filter(team => team.seed === null).sort(bySeed)
    unseeded.forEach((team, index) => { slots[team.id] = (lastSeed + index) % ACCENT_SLOT_COUNT })
    return slots
}

export function teamPageTeams(stats: EventTeamStats): AccentTeam[] {
    const teams: AccentTeam[] = [stats.team]
    for (const match of stats.matches) {
        if (match.opponent && !teams.some(team => team.id === match.opponent!.id)) teams.push(match.opponent)
    }
    return teams
}

export function teamNames(teams: readonly { id: string; name: string }[]): Record<string, string> {
    return Object.fromEntries(teams.map(team => [team.id, team.name]))
}

const RESULT_VERBS: Record<EventStatsResult, string> = { W: 'Won', D: 'Drew', L: 'Lost' }

export interface FormPip {
    result: EventStatsResult
    title: string
    matchId: string
    opponentId: string
}

export function formPips(form: readonly EventStatsFormEntry[], names: Record<string, string>): FormPip[] {
    return form.map(entry => {
        const opponent = names[entry.opponent_id]
        return {
            result: entry.result,
            title: opponent ? `${RESULT_VERBS[entry.result]} vs ${opponent}` : RESULT_VERBS[entry.result],
            matchId: entry.match_id,
            opponentId: entry.opponent_id,
        }
    })
}

export function formSummary(pips: readonly FormPip[]): string {
    if (pips.length === 0) return 'No results yet'
    return `Last ${plural(pips.length, 'result')}`
}

export interface PathPart {
    label: string
    next: boolean
}

export function pathParts(path: readonly EventStatsPathEntry[]): PathPart[] {
    const parts: PathPart[] = []
    path.forEach((entry, index) => {
        const place = entry.group ?? entry.stage_name
        parts.push({ label: entry.finish ? `${place} · ${entry.finish}` : place, next: false })
        if (entry.advanced_to && entry.advanced_to !== path[index + 1]?.stage_name) {
            parts.push({ label: entry.advanced_to, next: true })
        }
    })
    return parts
}

export function pathText(parts: readonly PathPart[]): string {
    return parts.map(part => part.label).join(' → ')
}

export const STANDING_LABELS: Record<EventStatsStanding, string> = {
    alive: 'Alive',
    eliminated: 'Eliminated',
    champion: 'Champion',
    withdrawn: 'Withdrawn',
    disqualified: 'Disqualified',
}

export const EMPTY_STAT = '—'

function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function playedCount(wdl: EventStatsWdl): number {
    return wdl.w + wdl.d + wdl.l
}

export function wdlText(wdl: EventStatsWdl): string {
    return `${wdl.w}-${wdl.d}-${wdl.l}`
}

export function capsText(caps: { for: number; against: number }): string {
    return `${caps.for}–${caps.against}`
}

export function seedLabel(seed: number | null): string {
    return seed === null ? 'Unseeded' : `Seed ${seed}`
}

export interface RecordsHeldView {
    label: string
    title: string
}

export function recordsHeldView(held: EventStatsRecordsHeld): RecordsHeldView | null {
    if (held.count === 0) return null
    return {
        label: plural(held.count, 'cup record'),
        title: held.maps.map(record => `${record.display_name} ${formatCapTime(record.run.team_time_seconds)}`).join(' · '),
    }
}

export interface TeamCardView {
    id: string
    name: string
    members: EventStatsTeamMember[]
    accentSlot: number
    seedLabel: string
    standing: { key: EventStatsStanding; label: string }
    path: PathPart[]
    pathText: string
    record: { matches: string; maps: string; caps: string }
    form: FormPip[]
    formSummary: string
    recordsHeld: RecordsHeldView | null
}

export interface TeamCardContext {
    slots: Record<string, number>
    names: Record<string, string>
}

export function teamCardView(team: EventStatsTeam, context: TeamCardContext): TeamCardView {
    const { matches, maps, caps } = team.record
    const played = playedCount(matches) > 0
    const path = pathParts(team.path)
    const form = formPips(team.form, context.names)
    return {
        id: team.id,
        name: team.name,
        members: team.members,
        accentSlot: context.slots[team.id] ?? ACCENT_SLOT_COUNT - 1,
        seedLabel: seedLabel(team.seed),
        standing: { key: team.standing, label: STANDING_LABELS[team.standing] },
        path,
        pathText: pathText(path),
        record: {
            matches: played ? wdlText(matches) : EMPTY_STAT,
            maps: played ? wdlText(maps) : EMPTY_STAT,
            caps: played ? capsText(caps) : EMPTY_STAT,
        },
        form,
        formSummary: formSummary(form),
        recordsHeld: recordsHeldView(team.records_held),
    }
}

export function ordinal(n: number): string {
    const teen = n % 100 >= 11 && n % 100 <= 13
    const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
    return `${n}${suffix}`
}

export interface TeamTilesView {
    matches: { value: string; form: FormPip[]; summary: string }
    maps: string
    caps: string
}

export function teamTilesView(stats: EventTeamStats): TeamTilesView {
    const { team } = stats
    const { matches, maps, caps } = team.record
    const matchesPlayed = playedCount(matches)
    const mapsPlayed = playedCount(maps) > 0
    const form = formPips(team.form, teamNames(teamPageTeams(stats)))
    return {
        matches: { value: matchesPlayed ? wdlText(matches) : EMPTY_STAT, form, summary: formSummary(form) },
        maps: mapsPlayed ? wdlText(maps) : EMPTY_STAT,
        caps: mapsPlayed ? capsText(caps) : EMPTY_STAT,
    }
}

export function runTimeText(seconds: number | null): string {
    return seconds === null ? EMPTY_STAT : formatCapTime(seconds)
}

export type ReplayKind = 'demo' | 'ghost'

export interface RunMemberView {
    user: string
    alias: string | null
    capId: string
    time: string
}

export interface RunView {
    time: string
    teamCapId: string | null
    members: RunMemberView[]
    region: string | null
    replay: ReplayKind | null
}

export function runView(run: EventRun): RunView {
    return {
        time: runTimeText(run.team_time_seconds),
        teamCapId: run.team_cap_id,
        members: run.members.map(member => ({
            user: member.user,
            alias: member.alias,
            capId: member.cap_id,
            time: runTimeText(member.cap_time_seconds),
        })),
        region: run.server?.region ?? null,
        replay: run.has_demo ? 'demo' : run.has_ghost ? 'ghost' : null,
    }
}

export const TIME_NOT_RECORDED = 'Time not recorded'

export interface MapSideView {
    runs: RunView[]
    placeholders: string[]
    noCapsText: string | null
}

export interface TeamMapView {
    ordinal: number
    map: string
    displayName: string
    played: boolean
    pickedByTeamId: string | null
    pickLabel: string | null
    score: string | null
    result: EventStatsResult | null
    notPlayedText: string | null
    sides: { for: MapSideView; against: MapSideView }
}

function mapSideView(runs: EventRun[], unrecorded: number, caps: number | null, played: boolean): MapSideView {
    return {
        runs: runs.map(runView),
        placeholders: Array.from({ length: unrecorded }, () => TIME_NOT_RECORDED),
        noCapsText: played && !caps ? 'No caps' : null,
    }
}

function pickLabel(map: EventTeamStatsMap, names: Record<string, string>): string | null {
    if (map.kind === 'decider') return 'Decider'
    if (!map.picked_by) return null
    return `Picked by ${names[map.picked_by] ?? 'TBD'}`
}

export function teamMapView(map: EventTeamStatsMap, names: Record<string, string>): TeamMapView {
    const scored = map.played && map.caps_for !== null && map.caps_against !== null
    return {
        ordinal: map.ordinal,
        map: map.map,
        displayName: map.display_name,
        played: map.played,
        pickedByTeamId: map.picked_by,
        pickLabel: pickLabel(map, names),
        score: scored ? capsText({ for: map.caps_for!, against: map.caps_against! }) : null,
        result: map.played ? map.result : null,
        notPlayedText: map.played ? null : 'Not played: the series was already decided.',
        sides: {
            for: mapSideView(map.runs_for, map.unrecorded_for, map.caps_for, map.played),
            against: mapSideView(map.runs_against, map.unrecorded_against, map.caps_against, map.played),
        },
    }
}

export type TeamMatchState = 'result' | 'live' | 'upcoming'

export interface TeamMatchView {
    id: string
    state: TeamMatchState
    statusLabel: string
    meta: string
    scheduledAt: string | null
    opponent: EventTeamStatsOpponent | null
    opponentLabel: string
    side: string | null
    score: string | null
    result: EventStatsResult | null
    pickBanLink: string
    note: string | null
    maps: TeamMapView[]
}

function matchState(match: EventTeamStatsMatch): TeamMatchState {
    if (match.status === 'complete' || match.status === 'forfeit') return 'result'
    return match.status === 'live' ? 'live' : 'upcoming'
}

const PICK_BAN_LINKS: Record<TeamMatchState, string> = {
    result: 'Replay pick & ban',
    live: 'Watch pick & ban',
    upcoming: 'Pick & ban',
}

function matchNote(match: EventTeamStatsMatch, state: TeamMatchState): string | null {
    if (state === 'live') return 'Stats update when the result is official.'
    if (state === 'upcoming') return 'Pick & ban opens before the match.'
    if (match.status === 'forfeit') return 'Decided by forfeit: no maps were played.'
    return null
}

export function teamMatchView(match: EventTeamStatsMatch, names: Record<string, string>): TeamMatchView {
    const state = matchState(match)
    const decided = state === 'result'
    const result = decided ? match.result : null
    return {
        id: match.id,
        state,
        statusLabel: decided ? (result ?? EMPTY_STAT) : state === 'live' ? 'Live' : 'Upcoming',
        meta: [match.stage_name, match.group, match.round_label].filter(Boolean).join(' · '),
        scheduledAt: match.scheduled_at,
        opponent: match.opponent,
        opponentLabel: match.opponent?.name ?? 'Opponent to be decided',
        side: match.own_side ? sideColorTag(match.own_side) : null,
        score: decided && match.score ? capsText(match.score) : null,
        result,
        pickBanLink: PICK_BAN_LINKS[state],
        note: matchNote(match, state),
        maps: decided ? match.maps.map(map => teamMapView(map, names)) : [],
    }
}

export interface StatCell {
    label: string
    value: string
}

export interface BarCell {
    value: string
    share: number
}

function rateText(rate: number | null): string {
    return rate === null ? EMPTY_STAT : `${Math.round(rate * 100)}%`
}

export interface MapTableRowView {
    map: string
    displayName: string
    played: string
    picks: BarCell
    bans: BarCell
    firstBans: string
    deciders: string
    pickerRate: string
    pickerRecord: string
    fastest: { run: RunView; teamId: string } | null
    compact: StatCell[]
}

export interface MapTableView {
    hasDeciders: boolean
    columns: ResponsiveColumn[]
    rows: MapTableRowView[]
    emptyText: string
}

export function mapTableView(maps: readonly EventStatsMap[]): MapTableView {
    const hasDeciders = maps.some(map => map.deciders > 0)
    const maxPicks = Math.max(1, ...maps.map(map => map.picks))
    const maxBans = Math.max(1, ...maps.map(map => map.bans))
    const columns: ResponsiveColumn[] = [
        { id: 'map', width: '12rem', required: true },
        { id: 'played', width: '5.5rem', priority: 90 },
        { id: 'picks', width: '9rem', priority: 80 },
        { id: 'bans', width: '9rem', priority: 75 },
        { id: 'firstBans', width: '6.5rem', priority: 50 },
        ...(hasDeciders ? [{ id: 'deciders', width: '6rem', priority: 45 }] : []),
        { id: 'picker', width: '8.5rem', priority: 60 },
        { id: 'fastest', width: '15rem', required: true },
    ]
    const rows = maps.map(map => {
        const pickerRate = rateText(map.picker_win_rate)
        const compact: StatCell[] = [
            { label: 'Played', value: String(map.played) },
            { label: 'Picks', value: String(map.picks) },
            { label: 'Bans', value: String(map.bans) },
            { label: '1st bans', value: String(map.first_bans) },
            { label: 'Picker wins', value: pickerRate },
            ...(hasDeciders ? [{ label: 'Deciders', value: String(map.deciders) }] : []),
        ]
        return {
            map: map.map,
            displayName: map.display_name,
            played: String(map.played),
            picks: { value: String(map.picks), share: map.picks / maxPicks },
            bans: { value: String(map.bans), share: map.bans / maxBans },
            firstBans: String(map.first_bans),
            deciders: String(map.deciders),
            pickerRate,
            pickerRecord: `${map.picker_wins}/${map.picker_games}`,
            fastest: map.fastest_run ? { run: runView(map.fastest_run), teamId: map.fastest_run.team_id } : null,
            compact,
        }
    })
    return { hasDeciders, columns, rows, emptyText: 'No maps played in this stage yet.' }
}

export interface MapProfileRowView {
    map: string
    displayName: string
    picked: string
    bannedBy: string
    bannedAgainst: string
    played: string
    wdl: string | null
    wdlShares: { w: number; d: number; l: number }
    caps: string
    bestRun: RunView | null
    rank: MapRankView | null
    compact: StatCell[]
}

export interface MapRankView {
    position: string
    of: string
    top: boolean
}

export function mapRankView(rank: { rank: number; of: number } | null): MapRankView | null {
    return rank && { position: ordinal(rank.rank), of: `of ${rank.of}`, top: rank.rank === 1 }
}

export interface MapProfileView {
    columns: ResponsiveColumn[]
    rows: MapProfileRowView[]
    emptyText: string
}

const MAP_PROFILE_COLUMNS: readonly ResponsiveColumn[] = [
    { id: 'map', width: '12rem', required: true },
    { id: 'picked', width: '6rem', priority: 70 },
    { id: 'bannedBy', width: '7rem', priority: 65 },
    { id: 'bannedAgainst', width: '8rem', priority: 60 },
    { id: 'played', width: '5.5rem', priority: 90 },
    { id: 'wdl', width: '7.5rem', priority: 85 },
    { id: 'caps', width: '6rem', priority: 50 },
    { id: 'best', width: '8rem', required: true },
    { id: 'rank', width: '6.5rem', required: true },
]

export function mapProfileView(rows: readonly EventTeamMapProfileRow[]): MapProfileView {
    return {
        columns: [...MAP_PROFILE_COLUMNS],
        rows: rows.map(row => {
            const wdl = row.played ? wdlText(row) : null
            const caps = row.played ? capsText({ for: row.caps_for, against: row.caps_against }) : EMPTY_STAT
            const share = (n: number) => (row.played ? n / row.played : 0)
            return {
                map: row.map,
                displayName: row.display_name,
                picked: String(row.picked),
                bannedBy: String(row.banned_by),
                bannedAgainst: String(row.banned_against),
                played: String(row.played),
                wdl,
                wdlShares: { w: share(row.w), d: share(row.d), l: share(row.l) },
                caps,
                bestRun: row.best_run ? runView(row.best_run) : null,
                rank: mapRankView(row.best_rank),
                compact: [
                    { label: 'Picked', value: String(row.picked) },
                    { label: 'Banned', value: String(row.banned_by) },
                    { label: 'Banned vs', value: String(row.banned_against) },
                    { label: 'Played', value: String(row.played) },
                    { label: 'W-D-L', value: wdl ?? EMPTY_STAT },
                    { label: 'Caps', value: caps },
                ],
            }
        }),
        emptyText: 'No pick & ban or maps in this stage yet.',
    }
}

export interface TeamRunRowView {
    map: string
    displayName: string
    run: RunView
    matchId: string
    opponentId: string
    opponentLabel: string
    stageName: string
    completedAt: string
    compactSubtitle: string
}

export interface TeamRunsView {
    columns: ResponsiveColumn[]
    rows: TeamRunRowView[]
    emptyText: string
}

const TEAM_RUNS_COLUMNS: readonly ResponsiveColumn[] = [
    { id: 'map', width: '12rem', required: true },
    { id: 'time', width: '8rem', required: true },
    { id: 'players', width: '13rem', priority: 90 },
    { id: 'opponent', width: '11rem', priority: 70 },
    { id: 'stage', width: '8.5rem', priority: 50 },
    { id: 'date', width: '6rem', priority: 60 },
    { id: 'replay', width: '3.5rem', priority: 80 },
]

export function teamRunsView(stats: EventTeamStats): TeamRunsView {
    const names = teamNames(teamPageTeams(stats))
    return {
        columns: [...TEAM_RUNS_COLUMNS],
        rows: stats.runs.map(run => {
            const opponentLabel = names[run.opponent_id] ?? 'TBD'
            return {
                map: run.map,
                displayName: run.display_name,
                run: runView(run),
                matchId: run.match_id,
                opponentId: run.opponent_id,
                opponentLabel,
                stageName: run.stage_name,
                completedAt: run.completed_at,
                compactSubtitle: `vs ${opponentLabel}`,
            }
        }),
        emptyText: 'No linked runs in this stage yet.',
    }
}

export async function readTeamOrNotFound<T>(read: Promise<T>): Promise<T | null> {
    try {
        return await read
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
    }
}

export type TeamPageStatus = 'loading' | 'error' | 'not-found' | 'ready'

export function teamPageStatus(read: { data: EventTeamStats | null | undefined; loading: boolean; error: string | null }): TeamPageStatus {
    if (read.data) return 'ready'
    if (read.error) return 'error'
    if (read.data === null && !read.loading) return 'not-found'
    return 'loading'
}
