import { describe, expect, it } from 'vitest'
import type { MatchPickBanStatus } from '@/app/utils/api'
import { pickBanAction, pickBanCardAffordance, type PickBanAction } from './pickBanEntryPoints'

describe('pickBanAction', () => {
    it.each<[MatchPickBanStatus, boolean, PickBanAction]>([
        ['none', false, null],
        ['none', true, null],
        ['lobby', false, 'live'],
        ['lobby', true, 'join'],
        ['running', false, 'live'],
        ['running', true, 'join'],
        ['paused', false, 'live'],
        ['paused', true, 'join'],
        ['complete', false, 'view'],
        ['complete', true, 'view'],
    ])('maps %s for a viewer who is rostered: %s to %s', (status, isRostered, action) => {
        expect(pickBanAction(status, isRostered)).toBe(action)
    })
})

describe('pickBanCardAffordance', () => {
    it('shows nothing with no session, or once it is complete', () => {
        expect(pickBanCardAffordance('none', false)).toBeNull()
        expect(pickBanCardAffordance('none', true)).toBeNull()
        expect(pickBanCardAffordance('complete', false)).toBeNull()
        expect(pickBanCardAffordance('complete', true)).toBeNull()
    })

    it.each<MatchPickBanStatus>(['lobby', 'running', 'paused'])('shows the live pill to a spectator while %s', (status) => {
        expect(pickBanCardAffordance(status, false)).toBe('live')
    })

    it.each<MatchPickBanStatus>(['lobby', 'running', 'paused'])('shows Join to a rostered viewer while %s', (status) => {
        expect(pickBanCardAffordance(status, true)).toBe('join')
    })
})
