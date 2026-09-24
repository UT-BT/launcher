import { describe, expect, it } from 'vitest'
import type { PickBanState } from '@/app/utils/api'
import { mergePickBanState } from './mergePickBanState'
import { ELIGIBLE_MAPS, T0, locked, pickBanState, readAt, started, unlockAt } from './pickBanFixtures'

function reparsed(state: PickBanState): PickBanState {
    return JSON.parse(JSON.stringify(state)) as PickBanState
}

describe('mergePickBanState', () => {
    it('takes the first payload as it is', () => {
        const first = pickBanState()

        expect(mergePickBanState(null, first)).toBe(first)
    })

    it('returns the previous state when nothing changed at all', () => {
        const previous = pickBanState()

        expect(mergePickBanState(previous, reparsed(previous))).toBe(previous)
    })

    it('keeps the identity of every unchanged card, step and member across a fresh payload', () => {
        const previous = started()
        const next = reparsed(readAt(previous, T0 + 1_000))

        const merged = mergePickBanState(previous, next)

        expect(merged).not.toBe(previous)
        expect(merged.server_now).toBe(next.server_now)
        expect(merged.pool).toBe(previous.pool)
        expect(merged.plan).toBe(previous.plan)
        expect(merged.teams).toBe(previous.teams)
        expect(merged.pacing).toBe(previous.pacing)
    })

    it('replaces only the step and card data that changed', () => {
        const previous = started()
        const next = reparsed(locked(previous, ELIGIBLE_MAPS[0], unlockAt(previous) + 2_000))

        const merged = mergePickBanState(previous, next)

        expect(merged.plan).not.toBe(previous.plan)
        expect(merged.plan[0]).not.toBe(previous.plan[0])
        expect(merged.plan[0].map).toBe(ELIGIBLE_MAPS[0])
        merged.plan.slice(1).forEach((step, offset) => expect(step).toBe(previous.plan[offset + 1]))
        merged.pool.forEach((card, index) => expect(card).toBe(previous.pool[index]))
        expect(merged.teams).toBe(previous.teams)
    })

    it('matches cards by map name, steps by plan index and members by user id, whatever their position', () => {
        const previous = pickBanState()
        const next = reparsed(previous)
        next.pool.reverse()
        next.plan.reverse()
        next.teams.team_a?.members.reverse()

        const merged = mergePickBanState(previous, next)

        expect(merged.pool.map((c) => c.map)).toEqual(next.pool.map((c) => c.map))
        for (const card of merged.pool) expect(card).toBe(previous.pool.find((c) => c.map === card.map))
        for (const step of merged.plan) expect(step).toBe(previous.plan.find((s) => s.index === step.index))
        for (const m of merged.teams.team_a?.members ?? []) {
            expect(m).toBe(previous.teams.team_a?.members.find((p) => p.id === m.id))
        }
        expect(merged.teams.team_b).toBe(previous.teams.team_b)
    })

    it('replaces a member whose presence changed and keeps the rest of the roster', () => {
        const previous = pickBanState()
        const next = reparsed(previous)
        next.teams.team_a!.members[1].online = false

        const merged = mergePickBanState(previous, next)

        expect(merged.teams.team_a).not.toBe(previous.teams.team_a)
        expect(merged.teams.team_a?.members[0]).toBe(previous.teams.team_a?.members[0])
        expect(merged.teams.team_a?.members[1]).not.toBe(previous.teams.team_a?.members[1])
        expect(merged.teams.team_a?.members[1].online).toBe(false)
        expect(merged.teams.team_b).toBe(previous.teams.team_b)
    })

    it('drops cards that left the pool and adds new ones', () => {
        const previous = pickBanState()
        const next = reparsed(previous)
        next.pool = [next.pool[0], { map: 'CTF-BT-New', tags: [], screenshot_version: null, excluded: false, exclusion: null }]

        const merged = mergePickBanState(previous, next)

        expect(merged.pool).toHaveLength(2)
        expect(merged.pool[0]).toBe(previous.pool[0])
        expect(merged.pool[1].map).toBe('CTF-BT-New')
    })
})
