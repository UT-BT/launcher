import { describe, expect, it } from 'vitest'
import { NO_RUN_DEMO_TITLE, runDemoBadge, runDemoIsTeamTime, runDemoWatchTitle } from './runDemoLabels'
import type { TeamCapRunDemo } from '@/app/utils/api'

const SLOWEST: TeamCapRunDemo = {
    cap_id: 'cap-slow',
    user: '10',
    alias: 'Slowpoke',
    cap_time_seconds: 12,
    is_slowest: true,
    available: true,
}

const FASTER_FALLBACK: TeamCapRunDemo = {
    cap_id: 'cap-fast',
    user: '20',
    alias: 'Speedy',
    cap_time_seconds: 9.5,
    is_slowest: false,
    available: true,
}

describe('run demo labels', () => {
    it('says the replay is the team time only when it really is', () => {
        const title = runDemoWatchTitle(SLOWEST, SLOWEST.cap_id)

        expect(title).toContain('Slowpoke')
        expect(title).toContain('whose time is the team time')
    })

    it("never claims a faster member's demo spans the whole run", () => {
        const title = runDemoWatchTitle(FASTER_FALLBACK, FASTER_FALLBACK.cap_id)

        expect(title).toContain('Speedy')
        expect(title).not.toContain('whose time is the team time')
        expect(title.toLowerCase()).toContain('ends before the team capped')
    })

    it('reports no replay when nothing resolved', () => {
        expect(runDemoWatchTitle(null, null)).toBe(NO_RUN_DEMO_TITLE)
        expect(runDemoWatchTitle(FASTER_FALLBACK, null)).toBe(NO_RUN_DEMO_TITLE)
    })

    it('names the member badge after what the demo actually is', () => {
        expect(runDemoBadge(SLOWEST)).toMatchObject({ kind: 'team-time', label: 'Run demo' })
        expect(runDemoBadge(FASTER_FALLBACK)).toMatchObject({ kind: 'closest', label: 'Closest demo' })
        expect(runDemoBadge(FASTER_FALLBACK).tooltip).not.toContain("time is the team time")
    })

    it('treats an unresolved demo as not the team time rather than assuming', () => {
        expect(runDemoIsTeamTime(null)).toBe(false)
        expect(runDemoIsTeamTime(undefined)).toBe(false)
        expect(runDemoBadge(null).kind).toBe('unknown')
        expect(runDemoBadge(undefined).kind).toBe('unknown')
    })

    it('claims nothing about the owner when the payload carries no demo description', () => {
        const title = runDemoWatchTitle(null, 'cap-derived-from-roster')

        expect(title).not.toBe(NO_RUN_DEMO_TITLE)
        expect(title).not.toContain('team time')
        expect(title.toLowerCase()).not.toContain('slowest')
        expect(title.toLowerCase()).not.toContain('ends before')
    })

    it('makes no claim in the badge when the payload carries no demo description', () => {
        const badge = runDemoBadge(null)

        expect(badge.tooltip).not.toContain('team time')
        expect(badge.tooltip.toLowerCase()).not.toContain('slowest')
        expect(badge.tooltip.toLowerCase()).not.toContain('ends before')
    })
})
