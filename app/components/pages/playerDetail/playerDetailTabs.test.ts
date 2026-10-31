import { describe, expect, it } from 'vitest'
import type { UserSummaryCounts } from '@/app/utils/api'
import { playerDetailTabs } from './playerDetailTabs'

function counts(overrides: Partial<UserSummaryCounts> = {}): UserSummaryCounts {
    return {
        total_caps: 12,
        verified_caps: 5,
        disallowed_caps: 0,
        certified_caps: 7,
        unique_maps: 4,
        wr_count: 1,
        uncapped_maps: 30,
        total_playtime_seconds: 3600,
        spectator_playtime_seconds: 0,
        map_review_count: 2,
        favorite_count: 3,
        ...overrides,
    }
}

function activeButtons(view: ReturnType<typeof playerDetailTabs>): string[] {
    return view.tabs.filter(t => !t.hidden && t.value === view.activeTab).map(t => t.label)
}

describe('playerDetailTabs', () => {
    it('falls back to All Caps, with its button active, when a stored Disallowed tab has a zero count', () => {
        const view = playerDetailTabs('disallowed', counts({ disallowed_caps: 0 }), 0)
        expect(view.activeTab).toBe('caps')
        expect(view.tabs.find(t => t.value === 'disallowed')?.hidden).toBe(true)
        expect(activeButtons(view)).toEqual(['All Caps'])
    })

    it('keeps a stored Disallowed tab while it has caps', () => {
        const view = playerDetailTabs('disallowed', counts({ disallowed_caps: 2 }), 0)
        expect(view.activeTab).toBe('disallowed')
        expect(activeButtons(view)).toEqual(['Disallowed'])
    })

    it('keeps a stored Disallowed tab while the summary is still loading', () => {
        expect(playerDetailTabs('disallowed', null, null).activeTab).toBe('disallowed')
    })

    it('falls back to All Caps, with its button active, when a stored Maps Authored tab has no maps', () => {
        const view = playerDetailTabs('maps', counts(), 0)
        expect(view.activeTab).toBe('caps')
        expect(activeButtons(view)).toEqual(['All Caps'])
    })

    it('keeps a stored Maps Authored tab while the authored count is still loading', () => {
        expect(playerDetailTabs('maps', counts(), null).activeTab).toBe('maps')
    })

    it('keeps a tab that never hides', () => {
        expect(playerDetailTabs('wrs', counts(), 0).activeTab).toBe('wrs')
    })
})
