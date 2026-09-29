import { describe, expect, it } from 'vitest'
import { previewView } from './previewView'
import {
    eliminationStageView,
    groupsStageView,
    previewCupRun,
    previewMember,
    previewOdds,
    previewSlot,
    previewSummary,
    previewTeam,
    previewTeamRef,
    streamPreview,
    swissRow,
    swissStageView,
} from './previewFixtures'
import type { StreamPreview } from './previewRead'

const NOW = Date.parse('2026-09-29T18:40:00Z')
const STARTS_AT = '2026-09-29T20:00:00+00:00'

function viewOf(overrides: Partial<StreamPreview> = {}) {
    return previewView({ preview: streamPreview(overrides), startsAt: STARTS_AT, now: NOW })
}

describe('previewView', () => {
    it('times the scene in UTC plus relative text', () => {
        expect(viewOf().kicker).toBe('20:00 UTC · in 1h 20m')
        expect(previewView({ preview: streamPreview(), startsAt: null, now: NOW }).kicker).toBeNull()
    })

    describe('lineup players', () => {
        it('picks each side’s lineup players from the roster stats, in lineup order', () => {
            const view = viewOf({ lineup: { a1: '310000000000000002', a2: '310000000000000001', b1: '320000000000000001', b2: '320000000000000002' } })

            expect(view.teams.a?.players.map(player => player.name)).toEqual(['Ben', 'Ada'])
            expect(view.teams.b?.players.map(player => player.name)).toEqual(['Cleo', 'Dex'])
            expect(view.teams.a?.players[1]).toEqual({
                id: '310000000000000001',
                name: 'Ada',
                title: previewTeam('a').members[0].title,
                careerCaps: '1,284',
                wrs: '23',
                wrSplit: '17 solo · 6 team',
                cupCaps: '19',
            })
        })

        it('leaves out a lineup player who is not on the roster and tops up from the roster in order', () => {
            const team = previewTeam('a', {
                members: [previewMember('1', 'Ada'), previewMember('2', 'Ben'), previewMember('3', 'Cal')],
            })
            const view = viewOf({
                teams: { a: team, b: previewTeam('b') },
                lineup: { a1: '3', a2: 'someone-else', b1: null, b2: null },
            })

            expect(view.teams.a?.players.map(player => player.name)).toEqual(['Cal', 'Ada'])
            expect(view.teams.b?.players.map(player => player.name)).toEqual(['Cleo', 'Dex'])
        })

        it('never shows the same player twice and shows fewer cards when the roster is short', () => {
            const team = previewTeam('b', { members: [previewMember('9', 'Solo')] })
            const view = viewOf({ teams: { a: previewTeam('a'), b: team }, lineup: { a1: null, a2: null, b1: '9', b2: '9' } })

            expect(view.teams.b?.players.map(player => player.name)).toEqual(['Solo'])
        })

        it('shows a nameless player by their id', () => {
            const team = previewTeam('a', { members: [previewMember('77', '', { display_name: null })] })
            const view = viewOf({ teams: { a: team, b: previewTeam('b') }, lineup: { a1: '77', a2: null, b1: null, b2: null } })

            expect(view.teams.a?.players[0].name).toBeNull()
        })
    })

    it('carries both seeds and leaves an empty slot empty', () => {
        const view = viewOf({ teams: { a: previewTeam('a'), b: null } })

        expect(view.teams.a).toMatchObject({ side: 'a', name: 'Crimson Cats', stageSeed: 2, preCupSeed: 5 })
        expect(view.teams.b).toBeNull()
    })

    describe('cup run', () => {
        it('keeps bracket order and shows the result from the team’s own side', () => {
            const view = viewOf()

            expect(view.teams.a?.cupRun.shown).toEqual([
                { matchId: 'g-1', round: 'R1', result: 'W', score: '3–1', opponent: 'Flagrunners' },
                { matchId: 'g-2', round: 'R2', result: 'D', score: '2–2', opponent: 'Ledge Lords' },
                { matchId: 'g-3', round: 'R3', result: 'W', score: '3–0', opponent: 'Burrow Gang' },
            ])
            expect(view.teams.a?.cupRun.earlier).toBe(0)
        })

        it('shows the latest three and counts the earlier ones', () => {
            const knockout = { stage: { key: 'final', name: 'Final Stage' }, round: { no: 1, label: 'Quarter-finals' } }
            const run = [
                previewCupRun('m1', 1, previewTeamRef('t1', 'One'), 'win', [3, 0]),
                previewCupRun('m2', 2, previewTeamRef('t2', 'Two'), 'loss', [1, 3]),
                previewCupRun('m3', 3, previewTeamRef('t3', 'Three'), 'win', [3, 1]),
                previewCupRun('m4', 4, previewTeamRef('t4', 'Four'), 'win', [3, 2]),
                previewCupRun('m5', 1, previewTeamRef('t5', 'Five'), 'win', [3, 0], knockout),
            ]
            const view = viewOf({ teams: { a: previewTeam('a', { cup_run: run }), b: previewTeam('b') } })

            expect(view.teams.a?.cupRun.shown.map(entry => [entry.matchId, entry.round])).toEqual([
                ['m3', 'R3'],
                ['m4', 'R4'],
                ['m5', 'Quarter-finals'],
            ])
            expect(view.teams.a?.cupRun.earlier).toBe(2)
        })

        it('marks a forfeit and a missing opponent', () => {
            const run = [previewCupRun('m1', 1, null, 'win', [0, 0], { status: 'forfeit' })]
            const view = viewOf({ teams: { a: previewTeam('a', { cup_run: run }), b: previewTeam('b') } })

            expect(view.teams.a?.cupRun.shown).toEqual([{ matchId: 'm1', round: 'R1', result: 'W', score: 'FF', opponent: 'TBD' }])
        })
    })

    it('shows recent form oldest first, padded to five', () => {
        const view = viewOf()

        expect(view.teams.a?.form).toEqual(['W', 'D', 'W', null, null])
        expect(view.teams.b?.form).toEqual(['W', 'L', 'W', null, null])
    })

    it('shows no form without insights', () => {
        const view = viewOf({ insights: { available: false } })

        expect(view.teams.a?.form).toEqual([null, null, null, null, null])
    })

    describe('stage view', () => {
        it('shows the group table with both teams marked in a group stage', () => {
            const view = viewOf({ stage_view: groupsStageView() })

            expect(view.stageView).toMatchObject({ kind: 'groups', title: 'Group B standings' })
            if (view.stageView.kind !== 'groups') throw new Error('expected a group table')
            expect(view.stageView.rows.slice(0, 3)).toEqual([
                { key: 'team-warp', rank: 1, name: 'Warp Rabbits', side: null, record: '4–0–0', maps: '12–3', points: 12 },
                { key: 'team-crimson', rank: 2, name: 'Crimson Cats', side: 'a', record: '2–1–0', maps: '8–3', points: 7 },
                { key: 'team-azure', rank: 3, name: 'Azure Owls', side: 'b', record: '2–0–1', maps: '7–4', points: 6 },
            ])
        })

        it('names the table after the stage when the match has no group', () => {
            const view = viewOf({ stage_view: groupsStageView({ group: null, rows: [] }) })

            expect(view.stageView).toMatchObject({ kind: 'groups', title: 'Group Stage standings', rows: [] })
        })

        it('shows the Swiss record in a Swiss stage', () => {
            const view = viewOf({ stage_view: swissStageView() })

            expect(view.stageView).toMatchObject({
                kind: 'swiss',
                title: 'Playoff Stage · Swiss',
                rule: 'Round 3 · 2 wins qualify · 2 losses out',
            })
            if (view.stageView.kind !== 'swiss') throw new Error('expected a Swiss record')
            expect(view.stageView.buckets).toEqual([
                { key: 'qualified', label: 'Qualified', status: 'qualified', count: 1, marked: [] },
                {
                    key: '1-1',
                    label: '1–1',
                    status: 'active',
                    count: 4,
                    marked: [{ side: 'a', name: 'Crimson Cats' }, { side: 'b', name: 'Azure Owls' }],
                },
                { key: 'eliminated', label: 'Eliminated', status: 'eliminated', count: 1, marked: [] },
            ])
        })

        it('orders open Swiss records by wins then losses', () => {
            const view = viewOf({
                stage_view: swissStageView({
                    rows: [
                        swissRow(previewTeamRef('t1', 'One'), 0, 1),
                        swissRow(previewTeamRef('t2', 'Two'), 1, 0, 'active', 'a'),
                        swissRow(previewTeamRef('t3', 'Three'), 1, 1, 'active', 'b'),
                        swissRow(previewTeamRef('t4', 'Four'), 1, 0),
                    ],
                }),
            })

            if (view.stageView.kind !== 'swiss') throw new Error('expected a Swiss record')
            expect(view.stageView.buckets.map(bucket => [bucket.label, bucket.count])).toEqual([['1–0', 2], ['1–1', 1], ['0–1', 1]])
        })

        it('shows each team’s bracket path and where the winner goes in an elimination stage', () => {
            const view = viewOf({ stage_view: eliminationStageView() })

            expect(view.stageView).toEqual({
                kind: 'single_elim',
                title: 'Final Stage · Bracket path',
                names: { a: 'Crimson Cats', b: 'Azure Owls' },
                paths: {
                    a: [{ matchId: 'qf-2', round: 'Quarter-finals', current: true, result: null, score: null, opponent: 'Azure Owls' }],
                    b: [
                        { matchId: 'or-2', round: 'Opening Round', current: false, result: 'W', score: '3–2', opponent: 'Flagrunners' },
                        { matchId: 'qf-2', round: 'Quarter-finals', current: true, result: null, score: null, opponent: 'Crimson Cats' },
                    ],
                },
                winnerPath: [
                    { matchId: 'sf-1', round: 'Semi-finals', waiting: 'Warp Rabbits' },
                    { matchId: 'final', round: 'Grand Final', waiting: null },
                ],
            })
        })

        it('names an undecided opponent by its slot label', () => {
            const stage = eliminationStageView({ path: { a: ['sf-1'], b: [] }, winner_path: [] })
            const semis = stage.rounds[2].matches[0]
            semis.slots[0] = { ...semis.slots[0], side: 'a' }
            const view = viewOf({ stage_view: stage })

            if (view.stageView.kind !== 'single_elim') throw new Error('expected a bracket path')
            expect(view.stageView.paths.a).toEqual([
                { matchId: 'sf-1', round: 'Semi-finals', current: false, result: null, score: null, opponent: 'Winner QF2' },
            ])
            expect(view.stageView.paths.b).toEqual([])
        })

        it('marks a forfeit on the bracket path', () => {
            const stage = eliminationStageView()
            const opening = stage.rounds[0].matches[1]
            stage.rounds[0].matches[1] = { ...opening, status: 'forfeit', slots: [{ ...opening.slots[0], score: null }, { ...opening.slots[1], score: null }] }
            const view = viewOf({ stage_view: stage })

            if (view.stageView.kind !== 'single_elim') throw new Error('expected a bracket path')
            expect(view.stageView.paths.b[0]).toMatchObject({ matchId: 'or-2', result: 'W', score: 'FF' })
        })

        it('does not show a team of this match as waiting for itself in the next match', () => {
            const stage = eliminationStageView()
            const semis = stage.rounds[2].matches[0]
            stage.rounds[2].matches[0] = { ...semis, slots: [previewSlot(null, { label: 'Winner QF1' }), previewSlot(previewTeamRef('team-a', 'Crimson Cats'), { side: 'a' })] }
            const view = viewOf({ stage_view: stage })

            if (view.stageView.kind !== 'single_elim') throw new Error('expected a bracket path')
            expect(view.stageView.winnerPath[0]).toEqual({ matchId: 'sf-1', round: 'Semi-finals', waiting: null })
        })

        it('falls back to the stage name for a stage kind it does not know', () => {
            const view = viewOf({ stage_view: { kind: 'round_robin', stage: { key: 'rr', name: 'League' } } })

            expect(view.stageView).toEqual({ kind: 'none', title: 'League' })
        })
    })

    describe('head-to-head', () => {
        it('tells the record from both sides and describes the last meeting', () => {
            expect(viewOf().headToHead).toEqual({
                meetings: '3 meetings',
                wins: { a: 1, b: 2 },
                draws: 0,
                last: 'Last: Fri 14 Aug, 19:00 UTC · 7 weeks ago',
                lastResult: 'Azure Owls won 3–1',
            })
        })

        it('reads a first meeting when there is no history', () => {
            expect(viewOf({ insights: { available: false } }).headToHead).toEqual({
                meetings: 'First meeting',
                wins: { a: 0, b: 0 },
                draws: 0,
                last: null,
                lastResult: null,
            })
        })

        it('describes a won and a drawn last meeting', () => {
            const won = viewOf({
                insights: { available: true, head_to_head: { played: 1, record: { win: 1, loss: 0, draw: 0 }, matches: [previewSummary('Azure Owls', 'win', [3, 1])] } },
            })
            const drawn = viewOf({
                insights: { available: true, head_to_head: { played: 1, record: { win: 0, loss: 0, draw: 1 }, matches: [previewSummary('Azure Owls', 'draw', [2, 2])] } },
            })

            expect(won.headToHead).toMatchObject({ meetings: '1 meeting', last: 'Last: Group Stage · Round 1', lastResult: 'Crimson Cats won 3–1' })
            expect(drawn.headToHead).toMatchObject({ draws: 1, lastResult: 'Drawn 2–2' })
        })

        it('is left out while a team is missing', () => {
            expect(viewOf({ teams: { a: previewTeam('a'), b: null } }).headToHead).toBeNull()
        })
    })

    describe('odds', () => {
        it('shows prices, decimal odds and totals when predictions are enabled', () => {
            const view = viewOf()

            expect(view.odds).toEqual({
                a: { percent: '58%', odds: '1.72', share: 0.58 },
                b: { percent: '42%', odds: '2.38', share: 0.42 },
                draw: null,
                totals: '164 predictions · 12,450 coins in the pool',
                note: 'The market closes when Picks & Bans start.',
            })
            expect(view.teams.a?.odds).toBe('58% · 1.72')
            expect(view.teams.b?.odds).toBe('42% · 2.38')
        })

        it('is hidden without predictions', () => {
            const view = viewOf({ predictions_enabled: false, odds: previewOdds() })

            expect(view.odds).toBeNull()
            expect(view.teams.a?.odds).toBeNull()
            expect(view.teams.b?.odds).toBeNull()
        })

        it('is hidden when there is no market yet, or it was refunded', () => {
            expect(viewOf({ odds: null }).odds).toBeNull()
            expect(viewOf({ odds: previewOdds({ status: 'voided' }) }).odds).toBeNull()
            expect(viewOf({ odds: previewOdds({ price: { a: null, b: 0.4, draw: null } }) }).odds).toBeNull()
        })

        it('shows the draw price and a closed market', () => {
            const view = viewOf({
                odds: previewOdds({ status: 'closed', draws_allowed: true, price: { a: 0.5, b: 0.3, draw: 0.2 }, position_count: 1, pool_stake: 50 }),
            })

            expect(view.odds).toMatchObject({
                a: { share: 0.5 },
                draw: { percent: '20%', odds: '5.00', share: 0.2 },
                totals: '1 prediction · 50 coins in the pool',
                note: 'Predictions are closed.',
            })
        })
    })
})
