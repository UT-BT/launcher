import { describe, expect, it } from 'vitest'
import { canOpenLobby, toQueueRow } from './pickBanQueue'
import type { PickBanQueueEntry } from '@/app/utils/api'

function entry(overrides: Partial<PickBanQueueEntry> = {}): PickBanQueueEntry {
    return {
        match_id: 'm1',
        stage_key: 'bracket',
        stage_name: 'Bracket',
        round_no: 1,
        round_label: null,
        scheduled_at: null,
        teams: { team_a: { id: 'a1', name: 'T01' }, team_b: { id: 'b1', name: 'T02' } },
        session_status: 'none',
        ready_count: 0,
        online_count: 0,
        startable: false,
        blocking_reason: 'no_session',
        ...overrides,
    }
}

describe('canOpenLobby', () => {
    it('allows opening when there is no current session', () => {
        expect(canOpenLobby('none')).toBe(true)
        expect(canOpenLobby('cancelled')).toBe(true)
        expect(canOpenLobby('voided')).toBe(true)
    })

    it('refuses while a session is already current', () => {
        expect(canOpenLobby('lobby')).toBe(false)
        expect(canOpenLobby('running')).toBe(false)
        expect(canOpenLobby('paused')).toBe(false)
        expect(canOpenLobby('complete')).toBe(false)
    })
})

describe('toQueueRow', () => {
    it('builds a row from a queue entry, falling back to Round N with no round label', () => {
        const row = toQueueRow(entry({ round_no: 3, round_label: null }), 'cup')

        expect(row.matchId).toBe('m1')
        expect(row.stageName).toBe('Bracket')
        expect(row.roundLabel).toBe('Round 3')
        expect(row.teamAName).toBe('T01')
        expect(row.teamBName).toBe('T02')
        expect(row.status).toBe('none')
        expect(row.canOpenLobby).toBe(true)
        expect(row.blockingReasonLabel).toBe('No lobby open')
    })

    it('prefers the servers round label over the Round N fallback', () => {
        const row = toQueueRow(entry({ round_no: 2, round_label: 'Semi-Finals' }), 'cup')
        expect(row.roundLabel).toBe('Semi-Finals')
    })

    it('labels a wrong_status block by what the current session is doing', () => {
        const row = toQueueRow(entry({ session_status: 'complete', blocking_reason: 'wrong_status' }), 'cup')
        expect(row.status).toBe('complete')
        expect(row.blockingReasonLabel).toBe('Pick/ban already complete')
    })

    it('reads TBD for an undecided side', () => {
        const row = toQueueRow(entry({ teams: { team_a: null, team_b: { id: 'b1', name: 'T02' } } }), 'cup')
        expect(row.teamAName).toBe('TBD')
        expect(row.teamBName).toBe('T02')
    })

    it('builds public-origin player and stream links', () => {
        const row = toQueueRow(entry({ match_id: '77' }), '2v2-cup-2026')
        expect(row.playerLink).toBe('https://utbt.net/events/2v2-cup-2026/matches/77')
        expect(row.streamLink).toBe('https://utbt.net/events/2v2-cup-2026/matches/77/stream')
    })

    it('carries the ready/online counts and scheduled time through unchanged', () => {
        const row = toQueueRow(entry({ ready_count: 2, online_count: 1, startable: true, blocking_reason: null, scheduled_at: '2026-09-26T20:00:00+00:00' }), 'cup')
        expect(row.readyCount).toBe(2)
        expect(row.onlineCount).toBe(1)
        expect(row.blockingReasonLabel).toBeNull()
        expect(row.scheduledAt).toBe('2026-09-26T20:00:00+00:00')
    })
})
