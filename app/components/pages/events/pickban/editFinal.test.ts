import { describe, expect, it } from 'vitest'
import type { PickBanState } from '@/app/utils/api'
import { buildPickBanView, type PickBanView } from './pickBanView'
import {
    addFinalEntry,
    finalDraftOf,
    finalEditorOf,
    moveFinalEntry,
    removeFinalEntry,
    setFinalDecider,
    setFinalMap,
    setFinalSide,
    type FinalDraft,
} from './editFinal'
import { ELIGIBLE_MAPS, HARD_MAP, T0, asManager, lockedInTurn, started } from './pickBanFixtures'

const [ALPHA, , CHARLIE, DELTA, , , GOLF] = ELIGIBLE_MAPS
const AFTER = T0 + 3_600_000

function viewOf(state: PickBanState): PickBanView {
    return buildPickBanView(state, { clockOffsetMs: 0, now: AFTER })
}

function complete(): PickBanView {
    return viewOf(asManager(lockedInTurn(started(), ELIGIBLE_MAPS.slice(0, 6))))
}

describe('seeding the editor', () => {
    it('starts from the final summary in play order, offering the eligible pool and both teams', () => {
        const view = complete()
        const editor = finalEditorOf(finalDraftOf(view), view)

        expect(editor.rows).toEqual([
            { key: 0, mapNumber: 1, map: CHARLIE, side: 'team_b', decider: false, canBeDecider: false, canMoveUp: false, canMoveDown: true, invalid: false },
            { key: 1, mapNumber: 2, map: DELTA, side: 'team_a', decider: false, canBeDecider: false, canMoveUp: true, canMoveDown: true, invalid: false },
            { key: 2, mapNumber: 3, map: GOLF, side: null, decider: true, canBeDecider: true, canMoveUp: true, canMoveDown: false, invalid: false },
        ])
        expect(editor.maps).toEqual([
            { map: ALPHA, label: 'Alpha' },
            { map: 'CTF-BT-Bravo', label: 'Bravo' },
            { map: CHARLIE, label: 'Charlie' },
            { map: DELTA, label: 'Delta' },
            { map: 'CTF-BT-Echo', label: 'Echo' },
            { map: 'CTF-BT-Foxtrot', label: 'Foxtrot' },
            { map: GOLF, label: 'Golf' },
        ])
        expect(editor.sides).toEqual([
            { side: 'team_a', ab: 'A', name: 'Crimson Cats' },
            { side: 'team_b', ab: 'B', name: 'Azure Owls' },
        ])
        expect(editor).toMatchObject({ canAdd: true, problems: [] })
        expect(editor.body).toEqual({
            maps: [
                { map: CHARLIE, picked_by: 'team_b', decider: false },
                { map: DELTA, picked_by: 'team_a', decider: false },
                { map: GOLF, picked_by: null, decider: true },
            ],
        })
    })
})

describe('validating', () => {
    it('needs at least one map', () => {
        const view = complete()
        const emptied = [0, 1, 2].reduce(removeFinalEntry, finalDraftOf(view))

        expect(finalEditorOf(emptied, view)).toMatchObject({ rows: [], problems: ['Add at least one map.'], body: null })
    })

    it('adds a blank map before a trailing decider, which needs a map and who picked it before it can be saved', () => {
        const view = complete()
        const added = addFinalEntry(finalDraftOf(view))

        const blank = finalEditorOf(added, view)
        expect(blank.rows.map(({ key, map, side, decider, invalid }) => ({ key, map, side, decider, invalid }))).toEqual([
            { key: 0, map: CHARLIE, side: 'team_b', decider: false, invalid: false },
            { key: 1, map: DELTA, side: 'team_a', decider: false, invalid: false },
            { key: 3, map: null, side: null, decider: false, invalid: true },
            { key: 2, map: GOLF, side: null, decider: true, invalid: false },
        ])
        expect(blank.problems).toEqual(['Map 3: choose a map.', 'Map 3: choose who picked it.'])
        expect(blank.body).toBeNull()

        const filled = finalEditorOf(setFinalSide(setFinalMap(added, 3, ALPHA), 3, 'team_a'), view)
        expect(filled.problems).toEqual([])
        expect(filled.body?.maps).toEqual([
            { map: CHARLIE, picked_by: 'team_b', decider: false },
            { map: DELTA, picked_by: 'team_a', decider: false },
            { map: ALPHA, picked_by: 'team_a', decider: false },
            { map: GOLF, picked_by: null, decider: true },
        ])
    })

    it('refuses a map listed more than once, flagging every row that lists it', () => {
        const view = complete()
        const editor = finalEditorOf(setFinalMap(finalDraftOf(view), 1, CHARLIE), view)

        expect(editor.problems).toEqual(['Charlie is listed more than once.'])
        expect(editor.rows.map((row) => row.invalid)).toEqual([true, true, false])
        expect(editor.body).toBeNull()
    })

    it('refuses a map outside the eligible pool, an excluded one included', () => {
        const view = complete()
        const draft = setFinalMap(setFinalMap(finalDraftOf(view), 0, HARD_MAP), 1, 'CTF-BT-Nowhere')
        const editor = finalEditorOf(draft, view)

        expect(editor.maps.map((choice) => choice.map)).not.toContain(HARD_MAP)
        expect(editor.problems).toEqual([
            'Map 1: Hard isn’t in this match’s eligible pool.',
            'Map 2: Nowhere isn’t in this match’s eligible pool.',
        ])
        expect(editor.rows.map((row) => row.invalid)).toEqual([true, true, false])
        expect(editor.body).toBeNull()
    })
})

describe('the decider', () => {
    const deciders = (draft: FinalDraft) => draft.entries.map((entry) => entry.decider)

    it('can only be marked on the last map', () => {
        const view = complete()
        const withoutDecider = setFinalDecider(finalDraftOf(view), 2, false)
        expect(deciders(withoutDecider)).toEqual([false, false, false])
        expect(finalEditorOf(withoutDecider, view).rows.map((row) => row.canBeDecider)).toEqual([false, false, true])

        expect(deciders(setFinalDecider(withoutDecider, 1, true))).toEqual([false, false, false])
        expect(deciders(setFinalDecider(withoutDecider, 2, true))).toEqual([false, false, true])
    })

    it('never carries who picked it, and gets its side back once unmarked', () => {
        const view = complete()
        const twoMaps = removeFinalEntry(finalDraftOf(view), 2)

        const deltaDecides = finalEditorOf(setFinalDecider(twoMaps, 1, true), view)
        expect(deltaDecides.rows[1]).toMatchObject({ map: DELTA, side: null, decider: true })
        expect(deltaDecides.body?.maps).toEqual([
            { map: CHARLIE, picked_by: 'team_b', decider: false },
            { map: DELTA, picked_by: null, decider: true },
        ])

        const unmarked = finalEditorOf(setFinalDecider(setFinalDecider(twoMaps, 1, true), 1, false), view)
        expect(unmarked.rows[1]).toMatchObject({ map: DELTA, side: 'team_a', decider: false })

        const golfUnmarked = finalEditorOf(setFinalDecider(finalDraftOf(view), 2, false), view)
        expect(golfUnmarked.problems).toEqual(['Map 3: choose who picked it.'])
    })

    it('refuses a decider that isn’t the last map, and more than one', () => {
        const view = complete()
        const seeded = finalDraftOf(view)
        const [charlie, delta, golf] = seeded.entries

        const misplaced = finalEditorOf({ ...seeded, entries: [charlie, golf, delta] }, view)
        expect(misplaced.problems).toEqual(['Only the last map can be the decider.'])
        expect(misplaced.rows.map((row) => row.invalid)).toEqual([false, true, false])
        expect(misplaced.rows.map((row) => row.canBeDecider)).toEqual([false, true, true])
        expect(misplaced.body).toBeNull()

        const twice = finalEditorOf({ ...seeded, entries: [charlie, { ...delta, decider: true }, golf] }, view)
        expect(twice.problems).toEqual(['Only one map can be the decider.', 'Only the last map can be the decider.'])
        expect(twice.rows.map((row) => row.invalid)).toEqual([false, true, true])
        expect(twice.body).toBeNull()
    })

    it('moves to the last map when marked there, so there is never more than one', () => {
        const view = complete()
        const seeded = finalDraftOf(view)
        const [charlie, delta, golf] = seeded.entries
        const misplaced: FinalDraft = { ...seeded, entries: [charlie, golf, { ...delta, side: 'team_a' }] }

        const moved = setFinalDecider(misplaced, delta.key, true)
        expect(deciders(moved)).toEqual([false, false, true])
        expect(finalEditorOf(moved, view).problems).toEqual(['Map 2: choose who picked it.'])
    })
})

describe('reordering and sizing', () => {
    const order = (draft: FinalDraft) => draft.entries.map((entry) => entry.map)

    it('moves a map up or down one place, renumbering the list, and never past either end', () => {
        const view = complete()
        const seeded = finalDraftOf(view)

        const swapped = moveFinalEntry(seeded, 0, 1)
        expect(order(swapped)).toEqual([DELTA, CHARLIE, GOLF])
        expect(finalEditorOf(swapped, view).rows.map(({ key, mapNumber }) => [key, mapNumber])).toEqual([[1, 1], [0, 2], [2, 3]])
        expect(finalEditorOf(swapped, view).body?.maps.map((entry) => entry.map)).toEqual([DELTA, CHARLIE, GOLF])
        expect(order(moveFinalEntry(swapped, 0, -1))).toEqual([CHARLIE, DELTA, GOLF])

        expect(order(moveFinalEntry(seeded, 0, -1))).toEqual([CHARLIE, DELTA, GOLF])
        expect(order(moveFinalEntry(seeded, 2, 1))).toEqual([CHARLIE, DELTA, GOLF])

        const deciderUp = moveFinalEntry(seeded, 2, -1)
        expect(order(deciderUp)).toEqual([CHARLIE, GOLF, DELTA])
        expect(finalEditorOf(deciderUp, view).problems).toEqual(['Only the last map can be the decider.'])
    })

    it('stops offering Add once every eligible map has a row', () => {
        const view = complete()
        const addFour = [1, 2, 3, 4].reduce(addFinalEntry, finalDraftOf(view))

        expect(finalEditorOf(addFinalEntry(finalDraftOf(view)), view).canAdd).toBe(true)
        expect(finalEditorOf(addFour, view)).toMatchObject({ canAdd: false })
        expect(addFour.entries).toHaveLength(7)
    })
})
