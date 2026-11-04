import { describe, expect, it } from 'vitest'
import type { LeaderboardEntry, TeamLeaderboardEntry } from '@/app/utils/api'
import { MAX_TEAM_RUNS } from '@/app/components/pages/runCompare/model/teamModel'
import { MAX_COMPARE_RUNS, parseCompareQuery } from '@/app/components/pages/runCompare/url/compareUrl'
import {
    canTick,
    compareQueryOf,
    compareSelection,
    soloCandidates,
    teamCandidates,
    toggled,
} from './compareSelection'

const id = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`

function solo(n: number, seconds: number, disallowed?: boolean): LeaderboardEntry {
    return {
        id: id(n), map: 'CTF-BT-Test', user: `u${n}`, alias: `Runner ${n}`, cap_time_seconds: seconds,
        added: '2026-01-01T00:00:00Z', cap_type: 0, verified: true, disallowed,
    }
}

function team(n: number, seconds: number, disallowed = false): TeamLeaderboardEntry {
    return {
        id: id(n), map: 'CTF-BT-Team', added: '2026-01-01T00:00:00Z', cap_time_seconds: seconds, verified: true,
        complete: true, disallowed, state: 'verified', team_size: 2, user: `u${n}`, medal: 0, members: [],
    }
}

const SOLO = [solo(1, 30), solo(2, 20), solo(3, 25), solo(4, 22, true)]

describe('map leaderboard compare selection', () => {
    it('lists the selected runs fastest first, whatever order they were ticked in', () => {
        const selection = compareSelection([id(1), id(2), id(3)], soloCandidates(SOLO), false)

        expect(selection.ids).toEqual([id(2), id(3), id(1)])
        expect(selection.full).toBe(false)
        expect(selection.note).toBeNull()
    })

    it('leaves out disallowed runs and runs no longer on the leaderboard', () => {
        const selection = compareSelection([id(4), id(9), id(1)], soloCandidates(SOLO), false)

        expect(selection.ids).toEqual([id(1)])
    })

    it('never lets a disallowed run be ticked', () => {
        const candidates = soloCandidates(SOLO)
        const selection = compareSelection([], candidates, false)

        expect(canTick(selection, candidates[3])).toBe(false)
        expect(canTick(selection, candidates[0])).toBe(true)
        expect(toggled(selection, candidates[3])).toEqual([])
    })

    it('ticks and unticks a run', () => {
        const candidates = soloCandidates(SOLO)
        const ticked = toggled(compareSelection([], candidates, false), candidates[0])
        expect(ticked).toEqual([id(1)])

        expect(toggled(compareSelection(ticked, candidates, false), candidates[0])).toEqual([])
    })

    it('stops at 10 solo runs with a note, while ticked runs stay untickable', () => {
        const entries = Array.from({ length: 11 }, (_, i) => solo(i + 1, 10 + i))
        const candidates = soloCandidates(entries)
        const selection = compareSelection(entries.slice(0, 10).map(entry => entry.id), candidates, false)

        expect(selection.full).toBe(true)
        expect(selection.note).toBe('A comparison holds at most 10 runs. Untick one to choose another.')
        expect(canTick(selection, candidates[10])).toBe(false)
        expect(toggled(selection, candidates[10])).toHaveLength(10)
        expect(canTick(selection, candidates[0])).toBe(true)
        expect(toggled(selection, candidates[0])).toHaveLength(9)
    })

    it('stops at 4 team runs on a team map', () => {
        const entries = Array.from({ length: 5 }, (_, i) => team(i + 1, 10 + i))
        const candidates = teamCandidates([...entries, team(6, 5, true)])
        const selection = compareSelection(entries.slice(0, 4).map(entry => entry.id), candidates, true)

        expect(selection.full).toBe(true)
        expect(selection.note).toBe('A comparison holds at most 4 team runs. Untick one to choose another.')
        expect(canTick(selection, candidates[4])).toBe(false)
        expect(canTick(selection, candidates[5])).toBe(false)
    })

    it('uses the compare page limits', () => {
        const many = Array.from({ length: 12 }, (_, i) => solo(i + 1, 10 + i))
        const manyTeams = Array.from({ length: 6 }, (_, i) => team(i + 1, 10 + i))

        expect(compareSelection(many.map(entry => entry.id), soloCandidates(many), false).ids).toHaveLength(MAX_COMPARE_RUNS)
        expect(compareSelection(manyTeams.map(entry => entry.id), teamCandidates(manyTeams), true).ids).toHaveLength(MAX_TEAM_RUNS)
    })

    it('writes the runs into a compare address the page reads back in the same order', () => {
        const query = compareQueryOf([id(2), id(3), id(1)])

        expect(query).toBe(`runs=${id(2)},${id(3)},${id(1)}`)
        expect(parseCompareQuery(query).state.runs).toEqual([id(2), id(3), id(1)])
    })
})
