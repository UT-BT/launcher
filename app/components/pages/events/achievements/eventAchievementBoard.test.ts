import { describe, expect, it } from 'vitest'

import type {
    EventAchievementBoard,
    EventAchievementBoardEntry,
    EventAchievementMeasureKind,
    EventAchievementPlayer,
} from '@/app/utils/api'
import {
    awardRule,
    boardSummary,
    chaseHint,
    emptyHoldersText,
    holdersHeading,
    measureText,
    measureTone,
    youLine,
} from './eventAchievementBoard'

function player(overrides: Partial<EventAchievementPlayer> = {}): EventAchievementPlayer {
    return {
        user_id: '290062867452133377',
        alias: 'soupy',
        title: null,
        value: 0,
        settled: 0,
        qualifies: false,
        awarded: false,
        ...overrides,
    }
}

function entry(kind: EventAchievementMeasureKind, overrides: Partial<EventAchievementBoardEntry> = {}): EventAchievementBoardEntry {
    return {
        code: 'cup_2026_prophet',
        name: 'The Prophet',
        description: '',
        goal: '',
        icon: 'Eye',
        unit: '',
        level: 5,
        title: null,
        unlocks_mid_event: false,
        measure: { kind, label: null },
        threshold: 1,
        min_settled: null,
        awaiting_final: false,
        names_hidden: false,
        qualifying_count: 0,
        awarded_count: 0,
        qualifying: [],
        chasing: [],
        you: null,
        ...overrides,
    }
}

describe('showing a value in the unit the server names', () => {
    it('formats each kind', () => {
        expect(measureText(entry('coins'), 50805)).toBe((50805).toLocaleString())
        expect(measureText(entry('signed_coins'), 1200)).toBe(`+${(1200).toLocaleString()}`)
        expect(measureText(entry('percent'), 68.4)).toBe('68.4%')
        expect(measureText(entry('signed_percent'), 12.5)).toBe('+12.5%')
        expect(measureText(entry('signed_percent'), -3)).toBe('-3%')
        expect(measureText(entry('count'), 2)).toBe('2')
    })

    it('shows nothing for a yes-or-no achievement or a missing value', () => {
        expect(measureText(entry('flag'), 1)).toBeNull()
        expect(measureText(entry('percent'), null)).toBeNull()
    })

    it('colours only the signed kinds', () => {
        expect(measureTone(entry('signed_coins'), 5)).toBe('up')
        expect(measureTone(entry('signed_percent'), -1)).toBe('down')
        expect(measureTone(entry('coins'), 5)).toBeNull()
    })
})

describe('saying what qualifying means', () => {
    it('calls a mid-event achievement earned and a standing qualifying', () => {
        expect(holdersHeading(entry('count', { unlocks_mid_event: true }), false)).toBe('Earned')
        expect(holdersHeading(entry('coins'), false)).toBe('Qualifying now')
    })

    it('calls everything awarded once the event is finalised', () => {
        expect(holdersHeading(entry('coins'), true)).toBe('Awarded')
        expect(awardRule(entry('coins'), true)).toBeNull()
    })

    it('states when each kind is awarded while the event runs', () => {
        expect(awardRule(entry('coins'), false)).toBe('Awarded when the event ends')
        expect(awardRule(entry('count', { unlocks_mid_event: true }), false)).toBe('Unlocks when earned')
    })
})

describe('an empty list', () => {
    it('waits for the final to be drawn', () => {
        expect(emptyHoldersText(entry('flag', { awaiting_final: true }), false)).toBe('Opens once the final is drawn')
    })

    it('gives a count but no names while the final is open', () => {
        expect(emptyHoldersText(entry('flag', { names_hidden: true, qualifying_count: 3 }), false))
            .toBe('3 backed the final · names show once it starts')
        expect(emptyHoldersText(entry('flag', { names_hidden: true }), false)).toBe('Nobody has backed the final yet')
    })
})

describe('how far a chaser has to go', () => {
    it('asks for settled predictions first on a rated achievement', () => {
        const rated = entry('percent', { threshold: 65, min_settled: 20 })

        expect(chaseHint(rated, player({ value: 80, settled: 14 }))).toBe('6 more settled')
        expect(chaseHint(rated, player({ value: 60, settled: 22 }))).toBe('needs 65%')
    })

    it('counts what is left on a count', () => {
        expect(chaseHint(entry('count', { threshold: 2 }), player({ value: 1 }))).toBe('1 to go')
    })

    it('measures a coin chase against the leader', () => {
        const prophet = entry('coins', { qualifying: [player({ value: 50805 })] })

        expect(chaseHint(prophet, player({ value: 34323 }))).toBe(`${(16482).toLocaleString()} behind`)
        expect(chaseHint(entry('coins'), player({ value: 34323 }))).toBeNull()
    })

    it('needs a coin of profit to be net positive', () => {
        expect(chaseHint(entry('signed_coins'), player({ value: 0 }))).toBe('1 short')
        expect(chaseHint(entry('signed_coins'), player({ value: -500 }))).toBe('501 short')
    })
})

describe('the viewer line', () => {
    it('is nothing for someone without a wallet', () => {
        expect(youLine(entry('coins'), false)).toBeNull()
    })

    it('holds a standing back as on track until the event is finalised', () => {
        const you = { value: 50805, settled: 15, qualifies: true, awarded: false }

        expect(youLine(entry('coins', { you }), false)).toBe(`${(50805).toLocaleString()} · On track`)
        expect(youLine(entry('coins', { you }), true)).toBe(`${(50805).toLocaleString()} · Earned`)
    })

    it('calls a qualifying mid-event achievement earned straight away', () => {
        const you = { value: 2, settled: 9, qualifies: true, awarded: false }

        expect(youLine(entry('count', { you, unlocks_mid_event: true }), false)).toBe('2 · Earned')
    })

    it('adds the settled count to a rated achievement', () => {
        const you = { value: 70, settled: 14, qualifies: false, awarded: false }

        expect(youLine(entry('percent', { you, min_settled: 20 }), false)).toBe('70% · 14 settled · Not yet')
    })
})

describe('the summary line', () => {
    const board = (finalised: boolean): EventAchievementBoard => ({
        event: null,
        finalised,
        participants: 57,
        achievements: [entry('coins'), entry('count', { unlocks_mid_event: true })],
    })

    it('splits the live achievements by when they are awarded', () => {
        expect(boardSummary(board(false))).toBe(
            'Live standings across 57 predictors. 1 unlock as soon as they are earned; 1 are awarded when the event ends.',
        )
    })

    it('reads as final once finalised', () => {
        expect(boardSummary(board(true))).toBe('Final standings across 57 predictors. These titles have been awarded.')
    })
})
