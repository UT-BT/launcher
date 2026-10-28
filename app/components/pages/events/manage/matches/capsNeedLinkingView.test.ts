import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    EVENT_CAP_FLAG_REASONS, linkEventMatchMapCaps, type EventCapFlagReason, type EventCapReviewItem,
} from '@/app/utils/api'
import { eventStatsFixture } from '@/app/utils/fixtures/eventStatsFixtures'
import { capsNeedLinkingRows, linkReviewRuns, reviewPrefill, reviewReason } from './capsNeedLinkingView'

const KNRK = { id: 'team-knrk', name: 'KNRK' }
const HOP = { id: 'team-hop', name: "Hop n' Twerk" }

function item(patch: Partial<EventCapReviewItem> = {}): EventCapReviewItem {
    return {
        match_id: 'match-1', stage_key: 'groups', round_label: 'Round 5',
        team_a: KNRK, team_b: HOP,
        ordinal: 1, map: 'CTF-BT-II-SkaarjInvasion-vF2', display_name: 'II-SkaarjInvasion-vF2',
        expected: { a: 1, b: 1 }, linked: { a: 0, b: 0 },
        reason: 'no_runs', detail: null,
        window: { from: '2026-10-04T19:05:22.444405+00:00', to: '2026-10-04T22:05:22.444405+00:00' },
        ...patch,
    }
}

const RED_A = { a: 'red', b: 'blue' } as const
const UNKNOWN = { a: null, b: null } as const

describe('reviewReason', () => {
    it('says what is missing for every reason the list can show', () => {
        const copy = Object.fromEntries(EVENT_CAP_FLAG_REASONS.map(reason => [reason, reviewReason(item({ reason }), RED_A)]))

        expect(copy).toEqual({
            no_runs: 'No runs found on this map during the match',
            too_few_runs: 'Not enough runs found',
            mixed_servers: 'Runs on more than one server',
            same_second_decider: 'Both teams capped within 2 seconds',
            run_used_elsewhere: 'A run is already linked to another match',
            no_window: 'No pick & ban or scheduled time to search from',
        } satisfies Record<EventCapFlagReason, string>)
    })

    it('names the short side by colour when the sides are set', () => {
        const short = item({ reason: 'too_few_runs', expected: { a: 2, b: 1 }, detail: { side: 'a', found: 1, expected: 2 } })

        expect(reviewReason(short, RED_A)).toBe('Only 1 of 2 Red runs found')
        expect(reviewReason(short, { a: 'blue', b: 'red' })).toBe('Only 1 of 2 Blue runs found')
    })

    it('names the short side by team when the sides are not set', () => {
        const short = item({ reason: 'too_few_runs', detail: { side: 'b', found: 1, expected: 2 } })

        expect(reviewReason(short, UNKNOWN)).toBe("Only 1 of 2 runs found for Hop n' Twerk")
    })

    it('says none were found when the short side has no runs at all', () => {
        const none = item({ reason: 'too_few_runs', detail: { side: 'a', found: 0, expected: 1 } })

        expect(reviewReason(none, RED_A)).toBe('No Red runs found, 1 expected')
        expect(reviewReason(none, UNKNOWN)).toBe('No runs found for KNRK, 1 expected')
    })
})

describe('reviewPrefill', () => {
    it('prefills the picker with the map and window, widening the end to the next whole minute', () => {
        expect(reviewPrefill(item())).toEqual({
            map: 'CTF-BT-II-SkaarjInvasion-vF2',
            from: '2026-10-04T19:05:22.444405+00:00',
            to: '2026-10-04T22:06:00.000Z',
        })
    })

    it('keeps a window end that already falls on a whole minute', () => {
        const window = { from: '2026-10-04T19:05:00+00:00', to: '2026-10-04T22:05:00+00:00' }

        expect(reviewPrefill(item({ window })).to).toBe('2026-10-04T22:05:00.000Z')
    })

    it('prefills nothing when there is no window, so the picker opens as usual', () => {
        expect(reviewPrefill(item({ reason: 'no_window', window: null }))).toEqual({})
    })
})

describe('capsNeedLinkingRows', () => {
    it('shows the match, the map and expected against linked caps for each side', () => {
        const [row] = capsNeedLinkingRows(
            [item({ expected: { a: 2, b: 1 }, linked: { a: 1, b: 0 } })],
            { 'match-1': KNRK.id },
        )

        expect(row).toMatchObject({
            key: 'match-1:1',
            match: "KNRK vs Hop n' Twerk",
            round: 'Round 5',
            map: 'II-SkaarjInvasion-vF2',
            sides: [
                { side: 'a', label: 'Red · Side A', team: 'KNRK', color: 'red', expected: 2, linked: 1 },
                { side: 'b', label: 'Blue · Side B', team: "Hop n' Twerk", color: 'blue', expected: 1, linked: 0 },
            ],
            reason: 'No runs found on this map during the match',
        })
    })

    it('follows the Red side to whichever team holds it', () => {
        const [row] = capsNeedLinkingRows([item()], { 'match-1': HOP.id })

        expect(row.sides.map(side => side.color)).toEqual(['blue', 'red'])
        expect(row.sides.map(side => side.label)).toEqual(['Blue · Side B', 'Red · Side A'])
    })

    it('leaves the colours off when the match has no Red side yet', () => {
        const [row] = capsNeedLinkingRows([item()], {})

        expect(row.sides.map(side => side.color)).toEqual([null, null])
        expect(row.sides.map(side => side.label)).toEqual(['Sides TBC', 'Sides TBC'])
    })

    it('reads every item of the review payload', () => {
        const { items } = eventStatsFixture('review')
        const rows = capsNeedLinkingRows(items, {})

        expect(rows).toHaveLength(items.length)
        expect(rows.map(row => row.reason)).toEqual([
            'No runs found on this map during the match',
            'No runs found for KNRK, 1 expected',
            'Runs on more than one server',
            'No pick & ban or scheduled time to search from',
            'A run is already linked to another match',
            'Both teams capped within 2 seconds',
        ])
        expect(rows.find(row => row.item.reason === 'no_window')?.prefill).toEqual({})
    })
})

describe('linking runs', () => {
    const caps = [{ cap_id: 'cap-1', side: 'a' as const }, { cap_id: 'cap-2', side: 'a' as const }]

    function stubLinkPut() {
        const fetchMock = vi.fn().mockResolvedValue(new Response(
            JSON.stringify({ success: true, data: { match: { id: 'match-1' } } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
        ))
        vi.stubGlobal('fetch', fetchMock)
        return () => {
            const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
            return { url, method: init.method, body: JSON.parse(init.body as string) }
        }
    }

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('keeps the recorded score when linking from the Caps-need-linking list', async () => {
        const sent = stubLinkPut()

        await linkReviewRuns('token', 'cup', item({ match_id: 'match-1', ordinal: 1 }), caps)

        expect(sent()).toMatchObject({
            url: expect.stringMatching(/\/tournaments\/cup\/admin\/matches\/match-1\/maps\/1\/caps$/),
            method: 'PUT',
            body: { caps, keep_counts: true },
        })
    })

    it('fills the counts from the links when called without keepCounts, as the match editor does', async () => {
        const sent = stubLinkPut()

        await linkEventMatchMapCaps('token', 'cup', 'match-1', 1, caps)

        expect(sent()).toMatchObject({ method: 'PUT', body: { caps, keep_counts: false } })
    })
})
