import { describe, expect, it } from 'vitest'
import { blockingReasonLabel, pickBanStatusBadge, statusOfPhase } from './pickBanStatus'

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

describe('blockingReasonLabel', () => {
    it('maps every reason the queue can send to human words', () => {
        expect(blockingReasonLabel('no_session', 'none')).toBe('No lobby open')
        expect(blockingReasonLabel('teams_not_decided', 'lobby')).toBe('Teams not decided')
        expect(blockingReasonLabel('a_undetermined', 'lobby')).toBe('Team A undetermined')
        expect(blockingReasonLabel('pre_cup_seed_missing', 'lobby')).toBe('A team is missing its pre-cup seed')
        expect(blockingReasonLabel('sequence_mismatch', 'lobby')).toBe('Sequence does not match the best-of')
        expect(blockingReasonLabel('pool_too_small', 'lobby')).toBe('Map pool is too small')
        expect(blockingReasonLabel('results_present', 'lobby')).toBe('Results already entered')
        expect(blockingReasonLabel('match_finished', 'lobby')).toBe('Match already finished')
    })

    it('says what the session past its lobby is doing when that is what blocks Start', () => {
        expect(blockingReasonLabel('wrong_status', 'running')).toBe('Pick/ban already in progress')
        expect(blockingReasonLabel('wrong_status', 'paused')).toBe('Pick/ban is paused')
        expect(blockingReasonLabel('wrong_status', 'complete')).toBe('Pick/ban already complete')
    })

    it('is null when there is nothing blocking', () => {
        expect(blockingReasonLabel(null, 'lobby')).toBeNull()
    })

    it('falls back for an unrecognized code rather than throwing', () => {
        expect(blockingReasonLabel('not_authorized', 'none')).toBe('Not startable')
    })
})
