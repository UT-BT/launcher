import { describe, expect, it } from 'vitest'
import { runCompareFixture } from '@/app/utils/fixtures/runCompareFixtures'
import type { CapCompareCandidate } from '@/app/utils/api'
import { candidateOptionLabel, candidateTag, defaultCompareCandidate } from './compareCandidates'

function candidate(alias: string, cap_time_seconds: number, has_ghost?: boolean): CapCompareCandidate {
    return { id: alias, user: `u-${alias}`, alias, cap_time_seconds, has_ghost }
}

describe('candidate tags', () => {
    it('tags a candidate Replay only when the cap and the candidate both have a replay', () => {
        const detail = runCompareFixture('capDetailCandidates')

        const tags = detail.compare_candidates.map(c => [c.alias, candidateTag(detail.cap.has_ghost, c)])

        expect(tags).toEqual([
            ['fierd_2', 'Replay'],
            ['At[3*ATB', 'Zones'],
            ['Arturek ;)', 'Replay'],
            ['[UTW]Nettlez', 'Replay'],
        ])
    })

    it('tags every candidate Zones when the cap has no replay', () => {
        const detail = runCompareFixture('capDetailCandidates')

        expect(detail.compare_candidates.map(c => candidateTag(false, c))).toEqual(['Zones', 'Zones', 'Zones', 'Zones'])
    })

    it('tags Zones when a payload does not say whether a run has a replay', () => {
        expect(candidateTag(undefined, candidate('a', 70, true))).toBe('Zones')
        expect(candidateTag(true, candidate('a', 70))).toBe('Zones')
    })

    it('labels an option with the player, the time and the tag', () => {
        expect(candidateOptionLabel(candidate('fierd_2', 72.685, true), 'Replay')).toBe('fierd_2 — 01:12.685 · Replay')
        expect(candidateOptionLabel({ ...candidate('x', 105.1), alias: null, user: '42' }, 'Zones')).toBe('42 — 01:45.100 · Zones')
    })
})

describe('the default comparison pick', () => {
    it('picks the nearest faster run with a replay', () => {
        const detail = runCompareFixture('capDetailCandidates')

        const pick = defaultCompareCandidate(detail.cap.cap_time_seconds, detail.cap.has_ghost, detail.compare_candidates)

        expect(pick?.alias).toBe('fierd_2')
    })

    it('skips a closer faster run that only has zones', () => {
        const candidates = [
            candidate('A', 101.002, true),
            candidate('B', 104.31, false),
            candidate('PHILLIP', 106.845, true),
            candidate('C', 108.12, false),
            candidate('D', 112.774, true),
        ]

        expect(defaultCompareCandidate(107.5, true, candidates)?.alias).toBe('PHILLIP')
    })

    it('falls back to the nearest faster run of any kind when no faster run has a replay', () => {
        const candidates = [candidate('B', 104.31, false), candidate('C', 105.0, false), candidate('D', 112.774, true)]

        expect(defaultCompareCandidate(107.5, true, candidates)?.alias).toBe('C')
    })

    it('picks the nearest faster run when the cap itself has no replay', () => {
        const candidates = [candidate('A', 101.0, true), candidate('B', 104.31, true), candidate('D', 112.774, true)]

        expect(defaultCompareCandidate(107.5, false, candidates)?.alias).toBe('B')
    })

    it('keeps the nearest slower run when nothing is faster', () => {
        const candidates = [candidate('D', 112.774, true), candidate('C', 108.12, false), candidate('E', 130, true)]

        expect(defaultCompareCandidate(107.5, true, candidates)?.alias).toBe('C')
    })

    it('keeps a run with the same time when nothing is faster', () => {
        const candidates = [candidate('D', 112.774, true), candidate('same', 107.5, false)]

        expect(defaultCompareCandidate(107.5, true, candidates)?.alias).toBe('same')
    })

    it('picks the nearest faster replay on a cap with a replay but no zones', () => {
        const detail = runCompareFixture('capDetailGhostOnly')

        const pick = defaultCompareCandidate(detail.cap.cap_time_seconds, detail.cap.has_ghost, detail.compare_candidates)

        expect(pick?.alias).toBe('Arturek ;)')
    })

    it('picks nothing when there is no candidate', () => {
        expect(defaultCompareCandidate(107.5, true, [])).toBeNull()
    })
})
