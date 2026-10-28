import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EventBracket } from '@/app/utils/api'
import { STATS_TAB_NEW_UNTIL, loadStatsTabSeen, saveStatsTabSeen, statsTabView } from './statsTab'

const published = { published: true } as EventBracket
const unpublished = { published: false } as EventBracket
const before = STATS_TAB_NEW_UNTIL - 1

describe('statsTabView', () => {
    it('calls the tab Stats, marked new, once the bracket is published', () => {
        expect(statsTabView(published, true, false, before)).toEqual({ label: 'Stats', isNew: true })
    })

    it('keeps the roster tab called Teams, never new, before the bracket is published', () => {
        expect(statsTabView(unpublished, true, false, before)).toEqual({ label: 'Teams', isNew: false })
        expect(statsTabView(null, true, false, before)).toEqual({ label: 'Teams', isNew: false })
    })

    it('waits for the bracket before switching the label', () => {
        expect(statsTabView(published, false, false, before)).toEqual({ label: 'Teams', isNew: false })
    })

    it('drops the new pill once seen, and for everyone after the cut-off', () => {
        expect(statsTabView(published, true, true, before).isNew).toBe(false)
        expect(statsTabView(published, true, false, STATS_TAB_NEW_UNTIL).isNew).toBe(false)
    })
})

describe('stats tab seen flag', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('round-trips through local storage', () => {
        const store = new Map<string, string>()
        vi.stubGlobal('window', {
            localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) },
        })

        expect(loadStatsTabSeen()).toBe(false)
        expect(saveStatsTabSeen()).toBe(true)
        expect(loadStatsTabSeen()).toBe(true)
    })

    it('treats blocked storage as not seen and never throws', () => {
        const blocked = () => {
            throw new Error('blocked')
        }
        vi.stubGlobal('window', { localStorage: { getItem: blocked, setItem: blocked } })

        expect(loadStatsTabSeen()).toBe(false)
        expect(saveStatsTabSeen()).toBe(false)
    })
})
