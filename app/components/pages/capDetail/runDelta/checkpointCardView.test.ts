import { describe, expect, it } from 'vitest'
import { runCompareFixture } from '@/app/utils/fixtures/runCompareFixtures'
import type { CapCompareCandidate } from '@/app/utils/api'
import { checkpointCardView, type CheckpointCardViewInput } from './checkpointCardView'

const ALIGNED = runCompareFixture('aligned')
const RUNNER_ID = ALIGNED.runner.cap_id

const BUN: CapCompareCandidate = {
    id: ALIGNED.reference.cap_id,
    user: ALIGNED.reference.user,
    alias: ALIGNED.reference.alias,
    cap_time_seconds: ALIGNED.reference.cap_time_ms / 1000,
    has_ghost: true,
}

const ZONES_ONLY = runCompareFixture('capDetailCandidates').compare_candidates.find(c => !c.has_ghost)!

function view(overrides: Partial<CheckpointCardViewInput>) {
    return checkpointCardView({
        capId: RUNNER_ID,
        capHasReplay: true,
        target: BUN,
        result: { runnerId: RUNNER_ID, referenceId: BUN.id, comparison: ALIGNED },
        zonetimesLoading: false,
        ...overrides,
    })
}

describe('the checkpoint card view', () => {
    it('keeps today\'s card, with no chip, when there is nothing to compare against', () => {
        expect(view({ target: null, result: null })).toEqual({ kind: 'none' })
    })

    it('shows the replay comparison for a Replay target once it has loaded', () => {
        const card = view({})
        expect(card.kind).toBe('replay')
        if (card.kind !== 'replay') return
        expect(card.chip).toBe('REPLAY')
        expect(card.rows.map(r => r.label)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'])
        expect(card.rows[9].deltaTotal.label).toBe('−1.077')
    })

    it('waits under the REPLAY chip while a Replay target is loading', () => {
        expect(view({ result: null })).toEqual({ kind: 'loading', chip: 'REPLAY' })
    })

    it('keeps waiting while the only result belongs to another pair', () => {
        expect(view({ result: { runnerId: RUNNER_ID, referenceId: ZONES_ONLY.id, comparison: null } }))
            .toEqual({ kind: 'loading', chip: 'REPLAY' })
        expect(view({ result: { runnerId: 'other-cap', referenceId: BUN.id, comparison: ALIGNED } }))
            .toEqual({ kind: 'loading', chip: 'REPLAY' })
    })

    it('uses zone checkpoints for a Zones target without asking for a comparison', () => {
        expect(view({ target: ZONES_ONLY, result: null })).toEqual({
            kind: 'zones',
            chip: 'ZONES',
            note: "At[3*ATB's run has no replay, so this uses zone checkpoints.",
        })
    })

    it('uses zone checkpoints when this run has no replay', () => {
        expect(view({ capHasReplay: false, result: null })).toEqual({
            kind: 'zones',
            chip: 'ZONES',
            note: 'This run has no replay, so this uses zone checkpoints.',
        })
    })

    it('falls back to zone checkpoints when the comparison request fails', () => {
        expect(view({ result: { runnerId: RUNNER_ID, referenceId: BUN.id, comparison: null } })).toEqual({
            kind: 'zones',
            chip: 'ZONES',
            note: 'The replay comparison is unavailable, so this uses zone checkpoints.',
        })
    })

    it("keeps waiting after a failed request until the selected run's zone checkpoints have loaded", () => {
        expect(view({ result: { runnerId: RUNNER_ID, referenceId: BUN.id, comparison: null }, zonetimesLoading: true }))
            .toEqual({ kind: 'loading', chip: 'REPLAY' })
    })

    it('shows a loaded replay comparison while the zone checkpoints are still loading', () => {
        expect(view({ zonetimesLoading: true }).kind).toBe('replay')
    })

    it('shows the routes differ state, with the coverage and the final gap only, for a pair whose routes differ', () => {
        const routesDiffer = runCompareFixture('routesDiffer')
        const target = { ...BUN, id: routesDiffer.reference.cap_id }
        expect(view({
            capId: routesDiffer.runner.cap_id,
            target,
            result: { runnerId: routesDiffer.runner.cap_id, referenceId: target.id, comparison: routesDiffer },
        })).toEqual({
            kind: 'routes_differ',
            chip: 'REPLAY',
            coveragePercent: 27,
            finalGap: { ms: -90, label: '−0.090', tone: 'ahead' },
        })
    })

    it('keeps a pair whose routes differ under REPLAY while the zone checkpoints are still loading', () => {
        const routesDiffer = runCompareFixture('routesDiffer')
        const target = { ...BUN, id: routesDiffer.reference.cap_id }
        expect(view({
            capId: routesDiffer.runner.cap_id,
            target,
            result: { runnerId: routesDiffer.runner.cap_id, referenceId: target.id, comparison: routesDiffer },
            zonetimesLoading: true,
        }).kind).toBe('routes_differ')
    })

    it.each(['separated', 'neverRejoins', 'long', 'short'] as const)(
        'never switches a %s pair with different lines to zone checkpoints',
        name => {
            const comparison = runCompareFixture(name)
            const target = { ...BUN, id: comparison.reference.cap_id }
            const card = view({
                capId: comparison.runner.cap_id,
                target,
                result: { runnerId: comparison.runner.cap_id, referenceId: target.id, comparison },
            })
            expect(card.kind).toBe('replay')
            if (card.kind !== 'replay') return
            expect(card.flagged).toBe(true)
            expect(card.chart.bands).toHaveLength(comparison.separations.length)
        },
    )

    it('draws a run that never rejoins with a band to the cap, the lone cap point and hollow dots in its bands', () => {
        const comparison = runCompareFixture('neverRejoins')
        const target = { ...BUN, id: comparison.reference.cap_id }
        const card = view({
            capId: comparison.runner.cap_id,
            target,
            result: { runnerId: comparison.runner.cap_id, referenceId: target.id, comparison },
        })
        if (card.kind !== 'replay') throw new Error(card.kind)
        expect(card.chart.bands.at(-1)).toMatchObject({ endMs: 39792, rejoined: false })
        expect(card.chart.capPoint).toEqual({ tMs: 39792, deltaMs: -14470, tone: 'ahead' })
        expect(card.chart.dots.filter(d => d.hollow).map(d => d.index)).toEqual([4, 5, 9, 10])
        expect(card.rows.filter(r => r.flagged).map(r => r.label)).toEqual(['S4', 'S5', 'S9', 'S10'])
        expect(card.bars.bars.filter(b => b.flagged).map(b => b.label)).toEqual(['S4', 'S5', 'S9', 'S10'])
    })
})
