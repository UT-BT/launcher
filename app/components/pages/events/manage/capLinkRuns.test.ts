import { describe, expect, it } from 'vitest'
import type { EventCapCandidate, EventCapCandidateMember, EventMatchCapLink, EventSide } from '@/app/utils/api'
import { eventStatsFixture } from '@/app/utils/fixtures/eventStatsFixtures'
import { candidateKey, capLinkSearchStart, defaultPicks, linkedCapRows, linkedCaps, tallyPicks } from './capLinkRuns'

function member(capId: string, side: EventSide | null = 'a'): EventCapCandidateMember {
    return {
        cap_id: capId, user: `user-${capId}`, alias: null, side,
        cap_time_seconds: 40, added: '2026-09-26 20:05:00', verified: true,
    }
}

function run(runId: string, capIds: string[], patch: Partial<EventCapCandidate> = {}): EventCapCandidate {
    return {
        team_run_id: runId, side: 'a', map: 'BT-Map', complete: true, completed_at: '2026-09-26 20:05:00',
        members: capIds.map(capId => member(capId, patch.side ?? 'a')),
        ...patch,
    }
}

function solo(capId: string, side: EventSide | null = 'b'): EventCapCandidate {
    return {
        team_run_id: null, side, map: 'BT-Map', complete: true, completed_at: '2026-09-26 20:06:00',
        members: [member(capId, side)],
    }
}

describe('candidateKey', () => {
    it('keys a team run by its run and a lone cap by its cap', () => {
        expect(candidateKey(run('RUN1', ['c1', 'c2']))).toBe('RUN1')
        expect(candidateKey(solo('c9'))).toBe('c9')
    })
})

describe('defaultPicks', () => {
    it('pre-picks every complete run and lone cap on its own side', () => {
        const candidates = [run('RUN1', ['c1', 'c2']), run('RUN2', ['c3', 'c4'], { side: 'b' }), solo('c5')]

        expect(defaultPicks(candidates)).toEqual({ RUN1: 'a', RUN2: 'b', c5: 'b' })
    })

    it('leaves out incomplete runs and runs with no side', () => {
        const candidates = [
            run('RUN1', ['c1'], { complete: false, completed_at: null }),
            run('RUN2', ['c2', 'c3'], { side: null }),
        ]

        expect(defaultPicks(candidates)).toEqual({})
    })
})

describe('tallyPicks', () => {
    it('counts one per picked run, however many members it has', () => {
        const candidates = [run('RUN1', ['c1', 'c2']), run('RUN2', ['c3', 'c4']), solo('c5')]

        expect(tallyPicks(candidates, { RUN1: 'a', RUN2: 'a', c5: 'b' })).toEqual({ a: 2, b: 1 })
    })

    it('counts a run on whichever side the admin chose', () => {
        expect(tallyPicks([run('RUN1', ['c1', 'c2'])], { RUN1: 'b' })).toEqual({ a: 0, b: 1 })
    })

    it('counts an incomplete run as zero even when it is picked', () => {
        const candidates = [run('RUN1', ['c1'], { complete: false, completed_at: null })]

        expect(tallyPicks(candidates, { RUN1: 'a' })).toEqual({ a: 0, b: 0 })
    })

    it('ignores candidates that are not picked', () => {
        expect(tallyPicks([run('RUN1', ['c1', 'c2']), solo('c3')], {})).toEqual({ a: 0, b: 0 })
    })
})

describe('linkedCaps', () => {
    it('links every member row of a picked run on the run side', () => {
        const candidates = [run('RUN1', ['c1', 'c2']), solo('c3'), run('RUN2', ['c4', 'c5'])]

        expect(linkedCaps(candidates, { RUN1: 'b', c3: 'b' })).toEqual([
            { cap_id: 'c1', side: 'b' },
            { cap_id: 'c2', side: 'b' },
            { cap_id: 'c3', side: 'b' },
        ])
    })

    it('never links an incomplete run', () => {
        const candidates = [run('RUN1', ['c1'], { complete: false, completed_at: null })]

        expect(linkedCaps(candidates, { RUN1: 'a' })).toEqual([])
    })
})

function link(capId: string, patch: Partial<EventMatchCapLink> = {}): EventMatchCapLink {
    return {
        cap_id: capId, side: 'a', user: `user-${capId}`, alias: `Alias ${capId}`, map: 'CTF-BT-Map',
        cap_time_seconds: 40, added: '2026-09-26 20:05:00',
        ...patch,
    }
}

function runLink(capId: string, runId: string, patch: Partial<EventMatchCapLink> = {}): EventMatchCapLink {
    return link(capId, {
        source: 'auto', team_run_id: runId, team_cap_id: `team-${runId}`, team_time_seconds: 118.607,
        has_ghost: false, has_demo: false,
        ...patch,
    })
}

describe('linkedCapRows', () => {
    it('folds the entries of one team run into a single row with the team time and the run link', () => {
        const caps = [
            runLink('c1', 'RUN1', { cap_time_seconds: 114.523 }),
            runLink('c2', 'RUN1', { cap_time_seconds: 118.607 }),
        ]

        expect(linkedCapRows(caps)).toEqual([{
            kind: 'run',
            key: 'a:RUN1',
            side: 'a',
            teamCapId: 'team-RUN1',
            seconds: 118.607,
            members: [
                { capId: 'c1', user: 'user-c1', alias: 'Alias c1' },
                { capId: 'c2', user: 'user-c2', alias: 'Alias c2' },
            ],
        }])
    })

    it('keeps two runs on the same map apart, in the order they were linked', () => {
        const caps = [
            runLink('c1', 'RUN1'), runLink('c2', 'RUN1'),
            runLink('c3', 'RUN2', { side: 'b', team_cap_id: 'team-RUN2', team_time_seconds: 66.87 }),
            runLink('c4', 'RUN2', { side: 'b', team_cap_id: 'team-RUN2', team_time_seconds: 66.87 }),
        ]

        expect(linkedCapRows(caps).map(row => row.kind === 'run' && [row.key, row.seconds, row.members.length]))
            .toEqual([['a:RUN1', 118.607, 2], ['b:RUN2', 66.87, 2]])
    })

    it('keeps a per-cap row for older entries that carry no run fields', () => {
        const caps = [link('c1'), link('c2', { side: 'b', cap_time_seconds: null })]

        expect(linkedCapRows(caps)).toEqual([
            { kind: 'cap', key: 'c1', cap: caps[0] },
            { kind: 'cap', key: 'c2', cap: caps[1] },
        ])
    })

    it('keeps a per-cap row for a lone cap that is not part of a team run', () => {
        const solo = link('c9', { source: 'admin', team_run_id: null, team_cap_id: null, team_time_seconds: null })

        expect(linkedCapRows([solo])).toEqual([{ kind: 'cap', key: 'c9', cap: solo }])
    })

    it('falls back to the slowest member time when the run time is missing', () => {
        const caps = [
            runLink('c1', 'RUN1', { cap_time_seconds: 50.1, team_time_seconds: null }),
            runLink('c2', 'RUN1', { cap_time_seconds: 52.4, team_time_seconds: null }),
        ]

        const [row] = linkedCapRows(caps)
        expect(row.kind === 'run' && row.seconds).toBe(52.4)
    })

    it('groups the fixture map with two linked 2v2 runs into two rows', () => {
        const { match } = eventStatsFixture('matchDetailLinks')
        const skaarj = match.maps?.find(row => row.map === 'CTF-BT-II-SkaarjInvasion-vF2')

        const rows = linkedCapRows(skaarj?.caps ?? [])
        expect(rows).toHaveLength(2)
        expect(rows.every(row => row.kind === 'run' && row.members.length === 2 && row.teamCapId)).toBe(true)
    })
})

describe('capLinkSearchStart', () => {
    const row = { map: 'CTF-BT-OldName', started_at: '2026-09-26 20:00:00', ended_at: '2026-09-26 21:00:00' }

    it('starts from the map row when nothing is prefilled', () => {
        expect(capLinkSearchStart(row)).toEqual({
            map: 'CTF-BT-OldName', from: '2026-09-26 20:00:00', to: '2026-09-26 21:00:00',
        })
    })

    it('starts from the prefilled map and window when they are given', () => {
        expect(capLinkSearchStart(row, {
            map: 'CTF-BT-NewName', from: '2026-10-04T19:05:22+00:00', to: '2026-10-04T22:05:22+00:00',
        })).toEqual({
            map: 'CTF-BT-NewName', from: '2026-10-04T19:05:22+00:00', to: '2026-10-04T22:05:22+00:00',
        })
    })

    it('keeps the map row value for any part of the prefill that is null', () => {
        expect(capLinkSearchStart(row, { map: null, from: null, to: null })).toEqual({
            map: 'CTF-BT-OldName', from: '2026-09-26 20:00:00', to: '2026-09-26 21:00:00',
        })
    })
})
