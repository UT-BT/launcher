import { describe, expect, it } from 'vitest'
import type { EventCapCandidate, EventCapCandidateMember, EventSide } from '@/app/utils/api'
import { candidateKey, defaultPicks, linkedCaps, tallyPicks } from './capLinkRuns'

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
