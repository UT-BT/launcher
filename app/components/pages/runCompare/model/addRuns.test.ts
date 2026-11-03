import { describe, expect, it } from 'vitest'
import type { LeaderboardEntry, ReplayVideo } from '@/app/utils/api'
import type { SoloRun } from '../loading/soloRuns'
import { addRunsEdit, addRunsModel, holdWhileAdding, IN_COMPARISON, NO_FILTERS, toggleRunEdit, VIDEO, type AddRunsFilters } from './addRuns'
import { composeCompareModel } from './compareModel'
import { RUN_LIMIT_REACHED } from './setEdits'

const IDS = Array.from({ length: 12 }, (_, i) => `${String(i).padStart(2, '0')}0000aa-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`)
const MAP = 'CTF-BT-NaliRealm'
const RED = 0
const BLUE = 1

function userOf(capId: string): string {
    return `7000000000000000${String(IDS.indexOf(capId)).padStart(2, '0')}`
}

function entry(capId: string, seconds: number, extra: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
    return {
        map: MAP,
        user: userOf(capId),
        cap_time_seconds: seconds,
        added: '2026-10-01 12:00:00',
        alias: `Player ${IDS.indexOf(capId) + 1}`,
        cap_type: 2,
        verified: true,
        id: capId,
        team: RED,
        active_title: null,
        has_ghost: true,
        zone_checkpoints: '1-0.050;3-37.464;',
        disallowed: false,
        ...extra,
    }
}

function runOf(row: LeaderboardEntry): SoloRun {
    return {
        capId: row.id,
        user: row.user,
        alias: row.alias,
        title: null,
        timeSeconds: row.cap_time_seconds,
        map: MAP,
        side: row.team === 0 || row.team === 1 ? row.team : null,
        hasGhost: row.has_ghost === true,
        zoneCheckpoints: row.zone_checkpoints ?? null,
        checkpoints: [],
        disallowed: false,
    }
}

function video(capId: string): ReplayVideo {
    return { source: 'utrecorder', mp4_url: `https://media.test/${capId}.mp4`, view_url: null, fps: 60 }
}

const BOARD = [
    entry(IDS[0], 70),
    entry(IDS[1], 72),
    entry(IDS[2], 74),
    entry(IDS[3], 76),
    entry(IDS[4], 78),
    entry(IDS[5], 80),
]

function modelOf(query: string, rows: readonly LeaderboardEntry[] = BOARD) {
    const runs = rows.map(runOf)
    return composeCompareModel({
        query,
        runs: new Map(runs.map(run => [run.capId, run])),
        videos: new Map(runs.map(run => [run.capId, video(run.capId)])),
        stageBox: { width: 1920, height: 1080 },
    })
}

function addRuns(query: string, options: { entries?: readonly LeaderboardEntry[]; userId?: string | null; filters?: Partial<AddRunsFilters>; videos?: ReadonlyMap<string, ReplayVideo | null> } = {}) {
    const entries = options.entries ?? BOARD
    return addRunsModel({
        entries,
        model: modelOf(query, entries),
        videos: options.videos ?? new Map(),
        userId: options.userId ?? null,
        filters: { ...NO_FILTERS, ...options.filters },
    })
}

function chip(query: string, id: string, options: Parameters<typeof addRuns>[1] = {}) {
    return addRuns(query, options).chips.find(candidate => candidate.id === id)
}

describe('quick-add chips', () => {
    it('WR targets the fastest verified run', () => {
        const entries = [entry(IDS[9], 65, { verified: false }), ...BOARD]
        expect(chip(`runs=${IDS[3]}`, 'wr', { entries })).toMatchObject({ label: 'WR', capIds: [IDS[0]], disabled: false })
    })

    it('WR is disabled, not hidden, when the record is already in the comparison', () => {
        expect(chip(`runs=${IDS[0]}`, 'wr')).toMatchObject({ capIds: [IDS[0]], disabled: true })
    })

    it('Your PB shows only when signed in and targets the player’s fastest run', () => {
        const entries = [...BOARD, entry(IDS[7], 77, { user: userOf(IDS[4]) })]
        expect(chip(`runs=${IDS[0]}`, 'pb', { entries })).toBeUndefined()
        expect(chip(`runs=${IDS[0]}`, 'pb', { entries, userId: userOf(IDS[4]) })).toMatchObject({ label: 'Your PB', capIds: [IDS[7]], disabled: false })
    })

    it('Your PB is disabled when the player has no run on the map', () => {
        expect(chip(`runs=${IDS[0]}`, 'pb', { userId: '799999999999999999' })).toMatchObject({ capIds: [], disabled: true })
    })

    it('next faster and next slower sit around the default reference, the fastest run of the set', () => {
        const query = `runs=${IDS[4]},${IDS[2]}`
        expect(chip(query, 'faster')).toMatchObject({ label: 'Next faster', capIds: [IDS[1]], disabled: false })
        expect(chip(query, 'slower')).toMatchObject({ label: 'Next slower', capIds: [IDS[3]], disabled: false })
    })

    it('next faster and next slower follow a pinned reference', () => {
        const query = `runs=${IDS[2]},${IDS[4]}&ref=${IDS[4]}`
        expect(chip(query, 'faster')?.capIds).toEqual([IDS[3]])
        expect(chip(query, 'slower')?.capIds).toEqual([IDS[5]])
    })

    it('next faster and next slower use the reference on the side of the first run in the set', () => {
        const entries = BOARD.map(row => (row.id === IDS[3] ? { ...row, team: BLUE } : row))
        const query = `runs=${IDS[3]},${IDS[0]}`
        expect(chip(query, 'faster', { entries })?.capIds).toEqual([IDS[2]])
        expect(chip(query, 'slower', { entries })?.capIds).toEqual([IDS[4]])
    })

    it('next faster skips unverified runs and is disabled when it is already in or there is none', () => {
        const entries = [...BOARD, entry(IDS[8], 73, { verified: false })]
        expect(chip(`runs=${IDS[2]}`, 'faster', { entries })?.capIds).toEqual([IDS[1]])
        expect(chip(`runs=${IDS[2]},${IDS[1]}&ref=${IDS[2]}`, 'faster')).toMatchObject({ capIds: [IDS[1]], disabled: true })
        expect(chip(`runs=${IDS[0]}`, 'faster')).toMatchObject({ capIds: [], disabled: true })
        expect(chip(`runs=${IDS[5]}`, 'slower')).toMatchObject({ capIds: [], disabled: true })
    })

    it('Top 3 targets the three fastest verified runs and is disabled once all three are in', () => {
        expect(chip(`runs=${IDS[1]}`, 'top3')).toMatchObject({ label: 'Top 3', capIds: [IDS[0], IDS[1], IDS[2]], disabled: false })
        expect(chip(`runs=${IDS[2]},${IDS[0]},${IDS[1]}`, 'top3')?.disabled).toBe(true)
    })

    it('every chip is disabled while the leaderboard has no rows', () => {
        const model = modelOf(`runs=${IDS[2]}`)
        const chips = addRunsModel({ entries: [], model, videos: new Map(), userId: userOf(IDS[2]), filters: NO_FILTERS }).chips
        expect(chips.map(c => c.id)).toEqual(['wr', 'pb', 'faster', 'slower', 'top3'])
        expect(chips.every(c => c.disabled)).toBe(true)
    })
})

function ids(rows: { capId: string }[]): string[] {
    return rows.map(row => row.capId)
}

describe('leaderboard rows', () => {
    it('list the map by time with the reference pinned at the top, and never a disallowed cap', () => {
        const entries = [entry(IDS[9], 60, { disallowed: true }), ...[...BOARD].reverse()]
        const model = addRuns(`runs=${IDS[3]},${IDS[4]}`, { entries })
        expect(ids(model.rows)).toEqual([IDS[3], IDS[0], IDS[1], IDS[2], IDS[4], IDS[5]])
        expect(model.reference).toBe(IDS[3])
        expect(model.rows.map(row => row.reference)).toEqual([true, false, false, false, false, false])
        expect(model.rows[0].time).toBe('1:16.000')
    })

    it('badge what each run gives: video, Replay or Zones, its side and whether it is in', () => {
        const entries = [
            entry(IDS[0], 70),
            entry(IDS[1], 72, { has_ghost: false, team: BLUE }),
            entry(IDS[2], 74, { has_ghost: false, zone_checkpoints: null }),
            entry(IDS[3], 76, { has_ghost: false, zone_checkpoints: ';', team: '' as unknown as number }),
        ]
        const videos = new Map([[IDS[0], video(IDS[0])], [IDS[1], null]])
        const badges = Object.fromEntries(addRuns(`runs=${IDS[0]}`, { entries, videos }).rows.map(row => [row.capId, row.badges]))
        expect(badges).toEqual({
            [IDS[0]]: [VIDEO, 'Replay', 'Set on Red', IN_COMPARISON],
            [IDS[1]]: ['No video', 'Zones', 'Set on Blue'],
            [IDS[2]]: ['Set on Red'],
            [IDS[3]]: [],
        })
    })

    it('search by player is case-insensitive over the rows', () => {
        const entries = [...BOARD, entry(IDS[6], 90, { alias: 'Bun`' })]
        expect(ids(addRuns(`runs=${IDS[0]}`, { entries, filters: { search: '  bUN ' } }).rows)).toEqual([IDS[6]])
        expect(ids(addRuns(`runs=${IDS[0]}`, { filters: { search: 'player 2' } }).rows)).toEqual([IDS[1]])
    })

    it('filter by has video, has replay and team colour', () => {
        const entries = [
            entry(IDS[0], 70),
            entry(IDS[1], 72, { has_ghost: false, team: BLUE }),
            entry(IDS[2], 74, { team: BLUE }),
            entry(IDS[3], 76),
        ]
        const videos = new Map([[IDS[0], video(IDS[0])], [IDS[1], video(IDS[1])], [IDS[2], null]])
        const rowsWith = (filters: Partial<AddRunsFilters>) => ids(addRuns(`runs=${IDS[0]}`, { entries, videos, filters }).rows)
        expect(rowsWith({ hasVideo: true })).toEqual([IDS[0], IDS[1]])
        expect(rowsWith({ hasReplay: true })).toEqual([IDS[0], IDS[2], IDS[3]])
        expect(rowsWith({ colour: 'blue' })).toEqual([IDS[1], IDS[2]])
        expect(rowsWith({ colour: 'red', hasVideo: true })).toEqual([IDS[0]])
    })
})

describe('adding and removing from the drawer', () => {
    const TEN = BOARD.concat([6, 7, 8, 9].map(i => entry(IDS[i], 80 + i)))

    it('a chip appends its runs in order and drops the start time', () => {
        const model = modelOf(`runs=${IDS[4]}&t=3.000`)
        expect(addRunsEdit(model, [IDS[0], IDS[1], IDS[2]], new Map())).toEqual({
            outcome: { query: `runs=${IDS[4]},${IDS[0]},${IDS[1]},${IDS[2]}`, blocked: null },
            note: null,
        })
    })

    it('adding past ten runs is blocked with the explanation, and a chip adds all or nothing', () => {
        const all = [...TEN, entry(IDS[10], 95), entry(IDS[11], 96)]
        const ten = IDS.slice(0, 10).join(',')
        expect(addRunsEdit(modelOf(`runs=${ten}`, all), [IDS[10]], new Map())).toEqual({ outcome: { query: null, blocked: RUN_LIMIT_REACHED }, note: null })
        const nine = IDS.slice(0, 9).join(',')
        expect(addRunsEdit(modelOf(`runs=${nine}`, all), [IDS[10], IDS[11]], new Map()).outcome).toEqual({ query: null, blocked: RUN_LIMIT_REACHED })
    })

    it('a run past eight video tiles joins as data-only with a one-line note', () => {
        const eight = IDS.slice(0, 8).join(',')
        const change = addRunsEdit(modelOf(`runs=${eight}`, TEN), [IDS[8]], new Map())
        expect(change.outcome.query).toBe(`runs=${eight},${IDS[8]}`)
        expect(change.note).toBe('Joined as data-only: 8 videos already play.')
        const after = modelOf(change.outcome.query!, TEN)
        expect(after.race.tiles).toHaveLength(8)
        expect(after.race.dataOnly.map(run => run.run.capId)).toEqual([IDS[8]])
    })

    it('counts only the runs that would want a tile toward the note', () => {
        const seven = IDS.slice(0, 7).join(',')
        const change = addRunsEdit(modelOf(`runs=${seven}`, TEN), [IDS[7], IDS[8], IDS[9]], new Map([[IDS[8], null]]))
        expect(change.note).toBe('Joined as data-only: 8 videos already play.')
        expect(addRunsEdit(modelOf(`runs=${seven}`, TEN), [IDS[7]], new Map()).note).toBeNull()
    })

    it('a run without a video joins with no note, and its lane says No video', () => {
        const change = addRunsEdit(modelOf(`runs=${IDS[0]}`), [IDS[1]], new Map([[IDS[1], null]]))
        expect(change.note).toBeNull()
        const runs = BOARD.map(runOf)
        const after = composeCompareModel({
            query: change.outcome.query!,
            runs: new Map(runs.map(run => [run.capId, run])),
            videos: new Map([[IDS[0], video(IDS[0])], [IDS[1], null]]),
        })
        expect(after.race.tiles.map(slot => slot.id)).toEqual([IDS[0]])
        expect(after.lanes.lanes.find(lane => lane.capId === IDS[1])?.badges).toContain('No video')
    })

    it('a row toggle adds a run that is out and removes one that is in', () => {
        const model = modelOf(`runs=${IDS[0]},${IDS[1]}&ref=${IDS[1]}`)
        expect(toggleRunEdit(model, IDS[2], new Map()).outcome.query).toBe(`runs=${IDS[0]},${IDS[1]},${IDS[2]}&ref=${IDS[1]}`)
        expect(toggleRunEdit(model, IDS[1], new Map()).outcome.query).toBe(`runs=${IDS[0]}`)
    })
})

describe('holding the stage while an added run loads', () => {
    const settled = modelOf(`runs=${IDS[0]},${IDS[1]}`)

    function loading(query: string) {
        return composeCompareModel({ query, runs: new Map(BOARD.slice(0, 2).map(row => [row.id, runOf(row)])) })
    }

    it('keeps the loaded runs on screen and edits from the requested set', () => {
        const query = `runs=${IDS[0]},${IDS[1]},${IDS[2]}`
        const held = holdWhileAdding(loading(query), settled)
        expect(held.loading).toBe(false)
        expect(held.race).toBe(settled.race)
        expect(held.query).toBe(query)
        const rows = addRunsModel({ entries: BOARD, model: held, videos: new Map(), userId: null, filters: NO_FILTERS }).rows
        expect(rows.find(row => row.capId === IDS[2])?.inComparison).toBe(true)
        expect(toggleRunEdit(held, IDS[2], new Map()).outcome.query).toBe(`runs=${IDS[0]},${IDS[1]}`)
    })

    it('shows the loading state for a set that is not an addition to the one on screen', () => {
        expect(holdWhileAdding(loading(`runs=${IDS[0]},${IDS[2]}`), settled).loading).toBe(true)
        expect(holdWhileAdding(loading(`runs=${IDS[2]}`), null).loading).toBe(true)
    })

    it('passes a loaded model through', () => {
        const fresh = modelOf(`runs=${IDS[0]}`)
        expect(holdWhileAdding(fresh, settled)).toBe(fresh)
    })
})
