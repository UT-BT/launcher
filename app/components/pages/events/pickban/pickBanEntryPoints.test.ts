import { describe, expect, it } from 'vitest'
import type { MatchPickBanStatus } from '@/app/utils/api'
import { pickBanCardAffordance, pickBanJoinBannerVisible } from './pickBanEntryPoints'

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

describe('pickBanJoinBannerVisible', () => {
    it('is hidden with no session', () => {
        expect(pickBanJoinBannerVisible(null)).toBe(false)
    })

    it('is visible for an open, running or paused session', () => {
        expect(pickBanJoinBannerVisible({ match_id: 'm1', status: 'lobby' })).toBe(true)
        expect(pickBanJoinBannerVisible({ match_id: 'm1', status: 'running' })).toBe(true)
        expect(pickBanJoinBannerVisible({ match_id: 'm1', status: 'paused' })).toBe(true)
    })
})
