import { displayMapName } from '@/app/utils/format'
import { deltaAxis } from '@/app/components/pages/capDetail/runDelta/chartRules'
import { signedGap } from '@/app/components/pages/capDetail/runDelta/deltaCurve'
import type { ComparisonRequest } from '../loading/comparisons'
import type { LoadedSoloRuns, SoloRun } from '../loading/soloRuns'
import type { LoadedTeamRuns, TeamRun } from '../loading/teamRuns'
import { parseCompareQuery } from '../url/compareUrl'
import type { CueModel, CuePoint } from './cueModel'
import { RUNG_BADGES, SET_ON, type Lane, type LaneMark, type LanesModel, type Rung } from './laneModel'
import { composeRace, formatRaceTime, type RaceInput, type RaceModel, type RaceRun, type TileSlot } from './raceModel'
import { leadSide, type References } from './referenceModel'
import { STAGE_GAP, TILE_ASPECT, type SlotRect, type StageBox, type StageLayout, type StageSlot } from './stageLayout'

export const MAX_TEAM_RUNS = 4
export const TEAM_COLOURS = ['#fbbf24', '#e879f9', '#22d3ee', '#a78bfa'] as const
export const TEAM_HEADER_HEIGHT = 28
export const TEAM_JOIN = ' & '

export interface TeamRow {
    teamCapId: string
    team: TeamRun
    label: string
    time: string
    colour: string
    reference: boolean
    pinned: boolean
    header: SlotRect | null
    lane: Lane | null
    badges: string[]
}

export interface TeamSeat {
    teamCapId: string
    index: number
    colour: string
}

export interface TeamModel {
    rows: TeamRow[]
    reference: string | null
    seats: ReadonlyMap<string, TeamSeat>
    requests: ComparisonRequest[]
    transposed: boolean
}

export const NO_TEAMS: TeamModel = { rows: [], reference: null, seats: new Map(), requests: [], transposed: false }

function msOf(seconds: number): number {
    return Math.round(seconds * 1000)
}

function nameOf(run: SoloRun): string {
    return run.alias?.trim() || run.user
}

export function teamLabel(team: TeamRun): string {
    return team.members.map(nameOf).join(TEAM_JOIN)
}

export function teamCompareTitle(teams: readonly TeamRun[], map: string | null): string | null {
    if (teams.length === 0 || !map) return null
    const where = `on ${displayMapName(map)}`
    const [first, second] = teams.map(teamLabel)
    if (teams.length === 1) return `${first} ${where}`
    if (teams.length === 2) return `${first} vs ${second} ${where}`
    return `${first}, ${second} and ${teams.length - 2} more ${where}`
}

function fastestTeam(teams: readonly TeamRun[]): TeamRun | null {
    return teams.reduce<TeamRun | null>((best, team) => (!best || team.timeSeconds < best.timeSeconds ? team : best), null)
}

export function composeTeams(teams: readonly TeamRun[], refs: readonly string[]): TeamModel {
    const pins = new Set(refs)
    const reference = teams.find(team => pins.has(team.teamCapId))?.teamCapId ?? fastestTeam(teams)?.teamCapId ?? null
    const rows = teams.map((team, i): TeamRow => ({
        teamCapId: team.teamCapId,
        team,
        label: teamLabel(team),
        time: formatRaceTime(team.timeSeconds),
        colour: TEAM_COLOURS[i % TEAM_COLOURS.length],
        reference: team.teamCapId === reference,
        pinned: pins.has(team.teamCapId),
        header: null,
        lane: null,
        badges: [],
    }))
    const seats = new Map(rows.flatMap(row => row.team.members.map((member, i): [string, TeamSeat] => [
        member.capId,
        { teamCapId: row.teamCapId, index: i + 1, colour: row.colour },
    ])))
    const requests = reference && rows.length > 1
        ? rows.filter(row => !row.reference).map(row => ({ runner: row.teamCapId, reference }))
        : []
    return { rows, reference, seats, requests, transposed: false }
}

export function teamVideoOrder(query: string, solo: LoadedSoloRuns, teams: LoadedTeamRuns): string[] {
    const members = new Set([...teams.values()].flatMap(team => team?.members.map(member => member.capId) ?? []))
    const state = parseCompareQuery(query, members).state
    const dataOnly = new Set(state.data)
    const ids = state.runs.flatMap(id => {
        const team = teams.get(id)
        if (team) return team.members.map(member => member.capId)
        return solo.get(id) === null ? [] : [id]
    })
    return [...ids.filter(id => !dataOnly.has(id)), ...ids.filter(id => dataOnly.has(id))]
}

export interface TeamRowLayout<S extends StageSlot> {
    layout: StageLayout<S>
    headers: SlotRect[]
    transposed: boolean
}

const NOTHING_PLACED = { columns: 0, rows: 0, tileWidth: 0, tileHeight: 0, placed: [] }

type GridRow<S> = readonly (S | null)[]

function gridTileWidth(lines: number, across: number, box: StageBox, bands: number, header: number, gap: number): number {
    const byWidth = (box.width - (across - 1) * gap) / across
    const byHeight = ((box.height - bands * header - (lines - 1) * gap) / lines) * TILE_ASPECT
    return Math.min(byWidth, byHeight)
}

export function packTeamRows<S extends StageSlot>(rows: readonly GridRow<S>[], box: StageBox, header = TEAM_HEADER_HEIGHT, gap = STAGE_GAP): TeamRowLayout<S> {
    const count = rows.length
    const columns = Math.max(0, ...rows.map(row => row.length))
    const transposed = count > 0 && columns > 0 && gridTileWidth(columns, count, box, 0, 0, gap) > gridTileWidth(count, columns, box, 0, 0, gap)
    const tileWidth = transposed ? gridTileWidth(columns, count, box, 1, header, gap) : gridTileWidth(count, columns, box, count, header, gap)
    if (count === 0 || columns === 0 || !(tileWidth > 0)) return { layout: NOTHING_PLACED, headers: [], transposed: false }
    const tileHeight = tileWidth / TILE_ASPECT
    const [across, down] = transposed ? [count, columns] : [columns, count]
    const gridWidth = across * tileWidth + (across - 1) * gap
    const left = (box.width - gridWidth) / 2
    const place = (r: number, c: number): SlotRect => {
        if (transposed) {
            const top = (box.height - (header + down * tileHeight + (down - 1) * gap)) / 2
            return { x: left + r * (tileWidth + gap), y: top + header + c * (tileHeight + gap), width: tileWidth, height: tileHeight }
        }
        const top = (box.height - (down * (header + tileHeight) + (down - 1) * gap)) / 2
        return { x: left + c * (tileWidth + gap), y: top + r * (header + tileHeight + gap) + header, width: tileWidth, height: tileHeight }
    }
    return {
        layout: {
            columns: across,
            rows: down,
            tileWidth,
            tileHeight,
            placed: rows.flatMap((row, r) => row.flatMap((slot, c) => (slot ? [{ slot, rect: place(r, c) }] : []))),
        },
        headers: rows.map((_, r) => {
            const first = place(r, 0)
            return transposed
                ? { x: first.x, y: first.y - header, width: tileWidth, height: header }
                : { x: left, y: first.y - header, width: gridWidth, height: header }
        }),
        transposed,
    }
}

function teamReferences(race: RaceModel, teams: TeamModel): References {
    const lead = teams.rows.find(row => row.reference)?.team.members[0]?.capId ?? null
    return { lead, sides: [], partners: new Map(race.runs.map(raceRun => [raceRun.run.capId, raceRun.run.capId])) }
}

function capResult(run: SoloRun): string {
    return `CAP ${formatRaceTime(run.timeSeconds)}`
}

export interface TeamRace {
    race: RaceModel
    teams: TeamModel
}

export interface TeamGridRow {
    columns: readonly (string | null)[]
    rest: readonly string[]
}

export type TeamGrid = ReadonlyMap<string, TeamGridRow>

function gridRows(tiles: readonly TileSlot[], teams: TeamModel, grid: TeamGrid | null): { row: TeamRow; cells: (TileSlot | null)[] }[] {
    const byId = new Map(tiles.map(tile => [tile.id, tile]))
    const rows = teams.rows.map(row => {
        const cells = grid?.get(row.teamCapId)
        if (!cells) return { row, cells: tiles.filter(tile => teams.seats.get(tile.id)?.teamCapId === row.teamCapId) as (TileSlot | null)[] }
        return { row, cells: [...cells.columns.map(capId => (capId === null ? null : byId.get(capId) ?? null)), ...cells.rest.flatMap(capId => byId.get(capId) ?? [])] }
    }).filter(entry => entry.cells.some(cell => cell !== null))
    const width = Math.max(0, ...rows.map(entry => entry.cells.length))
    const used = Array.from({ length: width }, (_, c) => rows.some(entry => entry.cells[c]))
    return rows.map(entry => {
        const cells = entry.cells.filter((_, c) => used[c])
        while (cells.length > 0 && cells[cells.length - 1] === null) cells.pop()
        return { row: entry.row, cells }
    })
}

export function composeTeamRace(input: RaceInput, teams: TeamModel, grid: TeamGrid | null = null): TeamRace {
    const base = composeRace({ ...input, state: { ...input.state, refs: [] } })
    const runs = base.runs.map((raceRun): RaceRun => ({
        ...raceRun,
        group: teams.seats.get(raceRun.run.capId)?.teamCapId,
        result: capResult(raceRun.run),
    }))
    const tiles = base.tiles.map((tile): TileSlot => ({ ...tile, result: capResult(tile.run) }))
    const byId = new Map(tiles.map(tile => [tile.id, tile]))
    const placedRows = gridRows(tiles, teams, grid)
    const gridded = base.view.mode === 'grid' && base.focused === null
    const packed = gridded ? packTeamRows(placedRows.map(entry => entry.cells), input.stageBox ?? { width: 0, height: 0 }) : null
    const headers = new Map(placedRows.map((entry, i) => [entry.row.teamCapId, packed?.headers[i] ?? null]))
    const layout = packed?.layout ?? { ...base.layout, placed: base.layout.placed.map(placed => ({ ...placed, slot: byId.get(placed.slot.id) ?? placed.slot })) }
    const race: RaceModel = { ...base, runs, tiles, dataOnly: runs.filter(raceRun => !raceRun.tile), layout }
    const references = teamReferences(race, teams)
    return {
        race: { ...race, references, reference: references.lead },
        teams: { ...teams, transposed: packed?.transposed ?? false, rows: teams.rows.map(row => ({ ...row, header: headers.get(row.teamCapId) ?? null })) },
    }
}

export function firstCrossings(run: SoloRun): Map<string, number> {
    const crossings = new Map<string, number>()
    run.checkpoints.forEach(checkpoint => {
        if (!crossings.has(checkpoint.zone)) crossings.set(checkpoint.zone, msOf(checkpoint.cumulative))
    })
    return crossings
}

export function memberMarks(run: SoloRun): LaneMark[] {
    const capMs = msOf(run.timeSeconds)
    const zones = [...firstCrossings(run)]
        .filter(([, atMs]) => atMs > 0 && atMs < capMs)
        .map(([label, atMs]): LaneMark => ({ kind: 'zone', label, atMs }))
    return [...zones.sort((a, b) => a.atMs - b.atMs), { kind: 'cap', label: 'CAP', atMs: capMs }]
}

function rungOf(run: SoloRun): Rung {
    if (run.hasGhost) return 'replay'
    return run.checkpoints.length > 0 ? 'zones' : 'time'
}

export function memberLane(raceRun: RaceRun, lead: number | null): Lane {
    const { run } = raceRun
    const rung = rungOf(run)
    const sideLabel = run.side !== null && lead !== null && run.side !== lead ? SET_ON[run.side] : null
    return {
        capId: run.capId,
        run,
        reference: false,
        rung,
        sideLabel,
        badges: [RUNG_BADGES[rung], ...(sideLabel ? [sideLabel] : []), ...(raceRun.tile ? [] : raceRun.badges)],
        capMs: msOf(run.timeSeconds),
        finalGap: signedGap(0),
        domainMs: deltaAxis(0, 0).domainMs,
        curves: [],
        bands: [],
        splits: [],
        trace: { kind: 'none' },
        marks: memberMarks(run),
    }
}

export function composeTeamLanes(race: RaceModel, teams: TeamModel): LanesModel {
    const reference = teams.rows.find(row => row.reference)
    const lead = reference ? leadSide(reference.team.members) : null
    return { lanes: race.runs.map(raceRun => memberLane(raceRun, lead)), requests: [], sectors: [] }
}

export function teamCrossings(team: TeamRun): Map<string, number> {
    const crossings = new Map<string, number>()
    team.members.forEach(member => {
        firstCrossings(member).forEach((atMs, zone) => {
            const seen = crossings.get(zone)
            if (seen === undefined || atMs < seen) crossings.set(zone, atMs)
        })
    })
    return crossings
}

export function composeTeamCues(teams: TeamModel): CueModel {
    const reference = teams.rows.find(row => row.reference)
    if (!reference) return { references: [], points: [], sectors: [], zones: [] }
    const capMs = msOf(reference.team.timeSeconds)
    const others = teams.rows.filter(row => row !== reference).map(row => ({ row, crossings: teamCrossings(row.team) }))
    const points = [...teamCrossings(reference.team)]
        .filter(([, atMs]) => atMs > 0 && atMs < capMs)
        .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
        .map(([zone, atMs]): CuePoint => {
            const runTimesMs = new Map([[reference.teamCapId, atMs]])
            others.forEach(({ row, crossings }) => {
                const own = crossings.get(zone)
                if (own !== undefined) runTimesMs.set(row.teamCapId, own)
            })
            return { key: `zone:${zone}`, kind: 'zone', label: zone, atMs, runTimesMs }
        })
    return { references: [reference.teamCapId], points, sectors: [], zones: points }
}
