import { describe, expect, it } from 'vitest'
import { ApiError, type EventMatch, type MatchPickBanStatus, type PredictionMarket, type PredictionMarketStatus } from '@/app/utils/api'
import { pickBanVetoErrorFixture } from '@/app/utils/fixtures/pickBanVetoFixtures'
import { streamSidesFixture } from '@/app/utils/fixtures/streamSidesFixtures'
import {
    RESULTS_AFTER_SLOTS, SIDE_LOCKED_HINT, changesOf, draftFrom, isSideLockedError, matchEditorErrorMessage, planSave,
    redSideLocked, redSideOptions, redSideSourceLabel, showsSlotWarning, withField, withMapRow, withRedSide, type MatchEditorDraft,
} from './matchEditorForm'

const TIMEZONE = 'UTC'
const T01 = '217b72f5-4186-56fd-ab7e-7631df450700'
const T04 = '3c889e6c-37c4-5552-a789-30ff137a5ee8'
const T07 = 'a7a7a7a7-0000-5000-8000-000000000007'
const NAMES: Record<string, string> = { [T01]: 'T01', [T04]: 'T04', [T07]: 'T07' }
const teamName = (teamId: string) => NAMES[teamId] ?? teamId

function savedMatch(patch: Partial<EventMatch> = {}): EventMatch {
    return { ...streamSidesFixture('adminMatch').match, ...patch }
}

function market(status: PredictionMarketStatus): PredictionMarket {
    return { status } as PredictionMarket
}

function draftOf(match: EventMatch, edit: (draft: MatchEditorDraft) => MatchEditorDraft = draft => draft) {
    return edit(draftFrom(match, TIMEZONE))
}

const swapSlots = (draft: MatchEditorDraft) =>
    withField(withField(draft, 'teamA', draft.fields.teamB), 'teamB', draft.fields.teamA)

const editFirstMap = (draft: MatchEditorDraft) => withMapRow(draft, 0, { caps_a: 4, caps_b: 2 })

describe('draftFrom', () => {
    it('starts the Red side from the saved red team', () => {
        expect(draftOf(savedMatch()).redSide).toBe(T04)
    })

    it('starts the Red side at Not set when the saved red team is in neither slot', () => {
        expect(draftOf(savedMatch({ red_team_id: T07 })).redSide).toBe('')
    })

    it('reports no changes on a fresh draft', () => {
        const match = savedMatch()

        expect(changesOf(match, draftOf(match), TIMEZONE)).toEqual({ fields: false, slots: false, redSide: false, result: false })
    })
})

describe('planSave', () => {
    it('sends only red_team_id in the PATCH when only the Red side changed', () => {
        const match = savedMatch()
        const draft = draftOf(match, d => withRedSide(d, T01))

        expect(planSave(match, draft, TIMEZONE)).toEqual({ patch: { red_team_id: T01 }, result: null })
    })

    it('sends null when the Red side is cleared to Not set', () => {
        const match = savedMatch()
        const draft = draftOf(match, d => withRedSide(d, ''))

        expect(planSave(match, draft, TIMEZONE)).toEqual({ patch: { red_team_id: null }, result: null })
    })

    it('leaves red_team_id out and sends no result when only the slots changed', () => {
        const match = savedMatch()
        const draft = draftOf(match, swapSlots)
        const plan = planSave(match, draft, TIMEZONE)

        expect(plan).toEqual({
            patch: {
                team_a_id: T04,
                team_b_id: T01,
                status: 'scheduled',
                scheduled_at: '2026-09-26T20:30:00.000Z',
                stream_url: 'https://twitch.tv/streamer',
                notes: null,
                published: true,
            },
            result: null,
        })
    })

    it('sends only the result when only the result section changed', () => {
        const match = savedMatch()
        const plan = planSave(match, draftOf(match, editFirstMap), TIMEZONE)

        expect('refused' in plan).toBe(false)
        if ('refused' in plan) return
        expect(plan.patch).toBeNull()
        expect(plan.result?.forfeit_winner).toBeNull()
        expect(plan.result?.maps).toHaveLength(5)
        expect(plan.result?.maps?.[0]).toMatchObject({ ordinal: 0, caps_a: 4, caps_b: 2 })
        expect(plan.result?.maps?.[0]).not.toHaveProperty('caps')
        expect(plan.result?.maps?.[0]).not.toHaveProperty('id')
    })

    it('sends the slots and the Red side together in one PATCH', () => {
        const match = savedMatch()
        const draft = draftOf(match, d => withRedSide(withField(d, 'teamB', T07), T07))
        const plan = planSave(match, draft, TIMEZONE)

        expect(plan).toMatchObject({ patch: { team_a_id: T01, team_b_id: T07, red_team_id: T07 }, result: null })
    })

    it('re-sends a kept Red side when the other slot gets a new team', () => {
        const match = savedMatch()
        const draft = draftOf(match, d => withField(d, 'teamA', T07))

        expect(draft.redSide).toBe(T04)
        expect(planSave(match, draft, TIMEZONE)).toMatchObject({ patch: { team_a_id: T07, team_b_id: T04, red_team_id: T04 }, result: null })
    })

    it('leaves red_team_id out when the slots change around a Red side that is Not set', () => {
        const match = savedMatch({ red_team_id: null })
        const plan = planSave(match, draftOf(match, d => withField(d, 'teamA', T07)), TIMEZONE)

        expect(plan).toMatchObject({ patch: { team_a_id: T07 }, result: null })
        expect('refused' in plan ? null : plan.patch).not.toHaveProperty('red_team_id')
    })

    it('refuses a save that changes the slots and the results together', () => {
        const match = savedMatch()
        const draft = draftOf(match, d => editFirstMap(swapSlots(d)))

        expect(planSave(match, draft, TIMEZONE)).toEqual({ refused: RESULTS_AFTER_SLOTS })
    })

    it('refuses a forfeit while the slots are changed', () => {
        const match = savedMatch()

        expect(planSave(match, draftOf(match, swapSlots), TIMEZONE, 'a')).toEqual({ refused: RESULTS_AFTER_SLOTS })
    })

    it('sends a forfeit as a result even with no map edits', () => {
        const match = savedMatch()
        const plan = planSave(match, draftOf(match), TIMEZONE, 'b')

        expect(plan).toMatchObject({ patch: null, result: { forfeit_winner: 'b' } })
    })

    it('keeps a recorded forfeit when the maps are saved again', () => {
        const match = savedMatch({ status: 'forfeit', winner_team_id: T04 })
        const plan = planSave(match, draftOf(match, editFirstMap), TIMEZONE)

        expect(plan).toMatchObject({ patch: null, result: { forfeit_winner: 'b' } })
    })

    it('sends nothing when nothing changed', () => {
        const match = savedMatch()

        expect(planSave(match, draftOf(match), TIMEZONE)).toEqual({ patch: null, result: null })
    })

    it('treats an edit put back as unchanged', () => {
        const match = savedMatch()
        const draft = draftOf(match, d => withField(withField(d, 'notes', 'late'), 'notes', ''))

        expect(planSave(match, draft, TIMEZONE)).toEqual({ patch: null, result: null })
    })
})

describe('Red side options', () => {
    it('offers Not set and the two slot teams', () => {
        expect(redSideOptions(draftOf(savedMatch()).fields, teamName)).toEqual([
            { value: '', label: 'Not set' },
            { value: T01, label: 'T01' },
            { value: T04, label: 'T04' },
        ])
    })

    it('follows the slot selects', () => {
        const draft = draftOf(savedMatch(), d => withField(d, 'teamB', T07))

        expect(redSideOptions(draft.fields, teamName).map(option => option.value)).toEqual(['', T01, T07])
    })

    it('leaves out an empty slot', () => {
        const draft = draftOf(savedMatch(), d => withField(d, 'teamA', ''))

        expect(redSideOptions(draft.fields, teamName).map(option => option.value)).toEqual(['', T04])
    })

    it('resets to Not set when its team leaves the slots', () => {
        const draft = draftOf(savedMatch(), d => withField(d, 'teamB', T07))

        expect(draft.redSide).toBe('')
        expect(changesOf(savedMatch(), draft, TIMEZONE).redSide).toBe(true)
    })

    it('keeps its team when the slots only swap', () => {
        const match = savedMatch()
        const draft = draftOf(match, swapSlots)

        expect(draft.redSide).toBe(T04)
        expect(changesOf(match, draft, TIMEZONE).redSide).toBe(false)
    })

    it('ignores a Red side that is in neither slot', () => {
        const draft = draftOf(savedMatch(), d => withRedSide(d, T07))

        expect(draft.redSide).toBe('')
    })

    it('shows the saved source while the Red side is unchanged', () => {
        const match = savedMatch({ red_side_source: 'step0' })
        const unset = savedMatch({ red_team_id: null, red_side_source: null })
        const sourceOf = (saved: EventMatch, draft: MatchEditorDraft) =>
            redSideSourceLabel(saved, draft, changesOf(saved, draft, TIMEZONE))

        expect(sourceOf(match, draftOf(match))).toBe('Step 0')
        expect(sourceOf(match, draftOf(match, swapSlots))).toBe('Step 0')
        expect(sourceOf(match, draftOf(match, d => withRedSide(d, T01)))).toBeNull()
        expect(sourceOf(match, draftOf(match, d => withField(d, 'teamA', T07)))).toBeNull()
        expect(sourceOf(unset, draftOf(unset))).toBeNull()
    })
})

describe('slot change warning', () => {
    it('warns when the slots change on a match with a market', () => {
        const match = savedMatch()
        const changes = changesOf(match, draftOf(match, swapSlots), TIMEZONE)

        expect(showsSlotWarning(changes, market('open'))).toBe(true)
        expect(showsSlotWarning(changes, market('closed'))).toBe(true)
    })

    it('stays quiet when the slots change on a match without a market', () => {
        const match = savedMatch()

        expect(showsSlotWarning(changesOf(match, draftOf(match, swapSlots), TIMEZONE), null)).toBe(false)
    })

    it('stays quiet when the market is already voided', () => {
        const match = savedMatch()

        expect(showsSlotWarning(changesOf(match, draftOf(match, swapSlots), TIMEZONE), market('voided'))).toBe(false)
    })

    it('stays quiet when only the Red side or the other fields change', () => {
        const match = savedMatch()
        const draft = draftOf(match, d => withField(withRedSide(d, T01), 'notes', 'moved'))

        expect(showsSlotWarning(changesOf(match, draft, TIMEZONE), market('open'))).toBe(false)
    })
})

describe('Red side lock', () => {
    const statusOf = (status: MatchPickBanStatus) => savedMatch({ pick_ban_status: status })

    it.each<[MatchPickBanStatus, boolean]>([
        ['none', false],
        ['lobby', false],
        ['running', true],
        ['paused', true],
        ['complete', false],
    ])('pick & ban %s locks the field: %s', (status, locked) => {
        expect(redSideLocked(statusOf(status))).toBe(locked)
    })

    it('words the hint as the dock instructions', () => {
        expect(SIDE_LOCKED_HINT).toBe('Pick & ban is running. Change sides with Undo, Restart or Swap in the pick/ban dock.')
    })

    it('sends no Red side while locked, even if the draft differs', () => {
        const match = statusOf('running')
        const draft = draftOf(match, d => withRedSide(d, T01))

        expect(changesOf(match, draft, TIMEZONE).redSide).toBe(false)
        expect(planSave(match, draft, TIMEZONE)).toEqual({ patch: null, result: null })
    })

    it('leaves red_team_id out of a slot or field save while locked', () => {
        const match = statusOf('paused')
        const plan = planSave(match, draftOf(match, d => withField(d, 'notes', 'moved')), TIMEZONE)

        expect(plan).toMatchObject({ patch: { notes: 'moved' } })
        expect(plan).not.toHaveProperty('patch.red_team_id')
    })

    it('does not send a clear when new slots push the Red team out while locked', () => {
        const match = statusOf('running')
        const redSlot = match.team_a?.id === match.red_team_id ? 'teamA' : 'teamB'
        const draft = draftOf(match, d => withField(d, redSlot, T07))
        const plan = planSave(match, draft, TIMEZONE)

        expect(draft.redSide).toBe('')
        expect(plan).toMatchObject({ patch: { team_a_id: expect.any(String) } })
        expect(plan).not.toHaveProperty('patch.red_team_id')
    })

    it('still sends the Red side when the lobby or a finished session leaves it open', () => {
        for (const status of ['lobby', 'complete', 'none'] as const) {
            const match = statusOf(status)
            const plan = planSave(match, draftOf(match, d => withRedSide(d, T01)), TIMEZONE)

            expect(plan).toEqual({ patch: { red_team_id: T01 }, result: null })
        }
    })
})

describe('matchEditorErrorMessage', () => {
    it('maps side_locked to the same sentence as the lock hint', () => {
        const refusal = pickBanVetoErrorFixture('errorSideLocked')
        const error = new ApiError(409, refusal.error, 'Request failed', refusal.code)

        expect(matchEditorErrorMessage(error)).toBe(SIDE_LOCKED_HINT)
        expect(isSideLockedError(error)).toBe(true)
    })

    it('keeps the server wording for any other refusal', () => {
        const conflict = new ApiError(409, 'Version mismatch', 'Request failed', 'version_conflict')

        expect(matchEditorErrorMessage(conflict)).toBe('Version mismatch')
        expect(isSideLockedError(conflict)).toBe(false)
    })

    it('falls back for an unknown error', () => {
        expect(matchEditorErrorMessage('boom')).toBe('Something went wrong. Please try again.')
    })
})
