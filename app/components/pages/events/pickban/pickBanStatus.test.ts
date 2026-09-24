import { describe, expect, it } from 'vitest'
import { pickBanStatusBadge, statusOfPhase } from './pickBanStatus'

describe('pickBanStatusBadge', () => {
    it('reads every session status in the same words wherever it is shown', () => {
        expect(pickBanStatusBadge('none').label).toBe('Not open')
        expect(pickBanStatusBadge('lobby').label).toBe('Lobby')
        expect(pickBanStatusBadge('running').label).toBe('Live')
        expect(pickBanStatusBadge('paused').label).toBe('Paused')
        expect(pickBanStatusBadge('complete').label).toBe('Complete')
        expect(pickBanStatusBadge('cancelled').label).toBe('Cancelled')
        expect(pickBanStatusBadge('voided').label).toBe('Voided')
    })

    it('groups the statuses with no session running under one idle tone', () => {
        expect(pickBanStatusBadge('none').tone).toBe('idle')
        expect(pickBanStatusBadge('cancelled').tone).toBe('idle')
        expect(pickBanStatusBadge('voided').tone).toBe('idle')
    })

    it('gives lobby, running, paused and complete their own tone', () => {
        expect(pickBanStatusBadge('lobby').tone).toBe('ready')
        expect(pickBanStatusBadge('running').tone).toBe('live')
        expect(pickBanStatusBadge('paused').tone).toBe('paused')
        expect(pickBanStatusBadge('complete').tone).toBe('done')
    })
})

describe('statusOfPhase', () => {
    it('reads the intro, a turn and a reveal as a running session', () => {
        expect(statusOfPhase('intro')).toBe('running')
        expect(statusOfPhase('awaiting')).toBe('running')
        expect(statusOfPhase('spotlight')).toBe('running')
    })

    it('keeps every other phase as the status of the same name', () => {
        expect(statusOfPhase('none')).toBe('none')
        expect(statusOfPhase('lobby')).toBe('lobby')
        expect(statusOfPhase('paused')).toBe('paused')
        expect(statusOfPhase('complete')).toBe('complete')
        expect(statusOfPhase('cancelled')).toBe('cancelled')
        expect(statusOfPhase('voided')).toBe('voided')
    })
})
