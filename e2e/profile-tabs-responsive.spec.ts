import { expect, test, type Locator, type Page } from '@playwright/test'
import type { Map as ApiMap, PlaytimeByMapRow, Record as WorldRecord, UserCapRow } from '../app/utils/api'
import { horizontalOverflow } from './layout'

const USER_ID = '1'
const LONG_MAP = 'CTF-BT-AnExtremelyLongMapNameThatWouldNeverFitOnAPhone-v12'
const SHORT_MAP = 'CTF-BT-Short'

function disallowedCap(id: string, mapName: string, reason: string | null): UserCapRow {
    return {
        id,
        mapName,
        author: 'Mapper',
        difficulty: 4,
        time: 83.512,
        medal: 'Casual',
        added: '2026-03-01T12:00:00Z',
        verified: false,
        disallowed: true,
        disallowed_at: '2026-03-02T12:00:00Z',
        disallow_reason: reason,
        cap_type: 1,
        isTeam: false,
        teamMembers: null,
        teamCapId: null,
    }
}

function worldRecord(capId: string, map: string, seconds: number): WorldRecord {
    return {
        cap_id: capId,
        user_id: USER_ID,
        map,
        added: '2026-02-10T08:30:00Z',
        cap_time_seconds: seconds,
        alias: 'Tester',
    }
}

function playtime(map: string, totalSeconds: number, sessions: number): PlaytimeByMapRow {
    return { map, total_seconds: totalSeconds, sessions, last_played: '2026-04-01T20:00:00Z' }
}

function mapRow(name: string, difficulty: number): ApiMap {
    return {
        name,
        added: '2025-11-20T00:00:00Z',
        difficulty,
        active: true,
        author: 'A Mapper With A Rather Long Credited Name',
        required_players: 1,
        has_screenshot: false,
        screenshot_updated: null,
    }
}

const DISALLOWED = [
    disallowedCap('c1', LONG_MAP, 'Used a movement exploit through the second gate that skips most of the route'),
    disallowedCap('c2', SHORT_MAP, null),
]
const WORLD_RECORDS = [worldRecord('w1', LONG_MAP, 41.27), worldRecord('w2', SHORT_MAP, 1234.5)]
const PLAYTIME = [playtime(LONG_MAP, 360_000, 1250), playtime(SHORT_MAP, 1800, 3)]
const UNCAPPED = [mapRow(LONG_MAP, 7), mapRow(SHORT_MAP, 2)]
const AUTHORED = [mapRow(LONG_MAP, 5), mapRow(SHORT_MAP, 1)]

const SUMMARY = {
    profile: { id: USER_ID, alias: 'Tester', registered_at: '2024-01-01T00:00:00Z', flag: null, utbt_role: 0 },
    medals: { user_id: USER_ID, world_records: WORLD_RECORDS.length, points: 100, rank: 7 },
    counts: {
        total_caps: 12,
        verified_caps: 8,
        disallowed_caps: DISALLOWED.length,
        unique_maps: 5,
        uncapped_maps: UNCAPPED.length,
        wr_count: WORLD_RECORDS.length,
    },
    recentCaps: [],
    recentWrs: [],
}

interface ProfileTab {
    button: RegExp
    list: string
    headers: string[]
    empty: string
}

const TABS: ProfileTab[] = [
    { button: /^Disallowed/, list: 'Disallowed caps', headers: ['Map', 'Time', 'Reason', 'Disallowed'], empty: 'No disallowed caps.' },
    { button: /^World Records/, list: 'World records', headers: ['Map', 'Time', 'Set', 'History'], empty: 'No world records held.' },
    { button: /^Playtime by Map/, list: 'Playtime by map', headers: ['Map', 'Time', 'Sessions', 'Last Played'], empty: 'No playtime recorded.' },
    { button: /^Uncapped Maps/, list: 'Uncapped maps', headers: ['Map', 'Author', 'Difficulty'], empty: 'All caught up — no uncapped maps.' },
    { button: /^Maps Authored/, list: 'Authored maps', headers: ['Map', 'Difficulty', 'Added'], empty: 'No maps in rotation are linked to this player.' },
]

function emptyTabRead(url: URL): unknown {
    const path = decodeURIComponent(url.pathname).replace(/\/$/, '')
    if (path === `/v2/summary/user/${USER_ID}/caps`) return { total: 0, items: [] }
    if (path === '/v2/world_records' && url.searchParams.get('user') === USER_ID && !url.searchParams.has('count')) return []
    if (path === `/playtime/by_map/${USER_ID}`) return { total: 0, items: [] }
    if (path === `/caps/uncapped/${USER_ID}` && !url.searchParams.has('count')) return []
    if (path === '/maps' && url.searchParams.get('author_ref') === USER_ID) return []
    return undefined
}

async function serveApi(page: Page) {
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())
        if (url.hostname === 'gateway.utbt.net') {
            await route.fulfill({ json: [] })
            return
        }
        const path = decodeURIComponent(url.pathname).replace(/\/$/, '')
        const ok = (data: unknown) => route.fulfill({ json: { success: true, data } })

        if (path === `/v2/summary/user/${USER_ID}`) return ok(SUMMARY)
        if (path === `/v2/summary/user/${USER_ID}/caps`) return ok({ total: DISALLOWED.length, items: DISALLOWED })
        if (path === `/v2/summary/user/${USER_ID}/activity`) return ok({ items: [] })
        if (path === '/v2/world_records' && url.searchParams.get('user') === USER_ID) {
            return ok(url.searchParams.has('count') ? { count: WORLD_RECORDS.length } : WORLD_RECORDS)
        }
        if (path === `/playtime/by_map/${USER_ID}`) return ok({ total: PLAYTIME.length, items: PLAYTIME })
        if (path === `/caps/uncapped/${USER_ID}`) {
            return ok(url.searchParams.has('count') ? { count: UNCAPPED.length } : UNCAPPED)
        }
        if (path === '/maps/count' && url.searchParams.get('author_ref') === USER_ID) return ok({ count: AUTHORED.length })
        if (path === '/maps' && url.searchParams.get('author_ref') === USER_ID) return ok(AUTHORED)
        if (path === '/v2/summary') {
            return ok({ global: { newMaps: 0, newRecords: 0 }, achievements: [], recentWorldRecords: [], newMaps: [], latestPatch: null })
        }
        return ok(path.endsWith('/count') ? { count: 0 } : [])
    })
}

async function openTab(page: Page, tab: ProfileTab) {
    const button = page.getByRole('button', { name: tab.button })
    await expect(button).toBeVisible()
    await button.click()
}

async function expectFitsWidth(list: Locator, viewportWidth: number) {
    const overflow = await list.evaluate(element => {
        const shell = element.parentElement ?? element
        return {
            shell: shell.scrollWidth - shell.clientWidth,
            list: element.scrollWidth - element.clientWidth,
            right: Math.max(...[...element.querySelectorAll('[role="listitem"]')].map(item => item.getBoundingClientRect().right)),
        }
    })
    expect(overflow.shell).toBeLessThanOrEqual(1)
    expect(overflow.list).toBeLessThanOrEqual(1)
    expect(overflow.right).toBeLessThanOrEqual(viewportWidth)
}

test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.message))
    await page.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    await serveApi(page)
})

test.describe('phone (390px)', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('every profile tab shows card rows without horizontal overflow', async ({ page, isMobile }) => {
        test.skip(!isMobile)
        await page.goto(`/players/${USER_ID}`)

        for (const tab of TABS) {
            await openTab(page, tab)
            const list = page.getByRole('list', { name: tab.list })
            await expect(list).toBeVisible()
            await expect(list.getByRole('listitem')).toHaveCount(2)
            await expect(list).toContainText(SHORT_MAP.replace(/^CTF-BT-/, ''))
            await expect(page.getByRole('table')).toHaveCount(0)
            await expectFitsWidth(list, 390)
            expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        }
    })

    test('every profile tab shows skeleton card rows while its list loads', async ({ page, isMobile }) => {
        test.skip(!isMobile)
        await page.route(/https:\/\/api\.utbt\.net\/.*/, async route => {
            if (emptyTabRead(new URL(route.request().url())) === undefined) return route.fallback()
        })
        await page.goto(`/players/${USER_ID}`)

        for (const tab of TABS) {
            await openTab(page, tab)
            const list = page.getByRole('list', { name: tab.list })
            await expect(list).toBeVisible()
            await expect(list.getByRole('listitem')).toHaveCount(5)
            await expect(list.locator('.animate-pulse')).toHaveCount(5)
            await expectFitsWidth(list, 390)
        }
    })

    test('every profile tab shows its empty message as a card row', async ({ page, isMobile }) => {
        test.skip(!isMobile)
        await page.route(/https:\/\/api\.utbt\.net\/.*/, async route => {
            const data = emptyTabRead(new URL(route.request().url()))
            if (data === undefined) return route.fallback()
            return route.fulfill({ json: { success: true, data } })
        })
        await page.goto(`/players/${USER_ID}`)

        for (const tab of TABS) {
            await openTab(page, tab)
            const list = page.getByRole('list', { name: tab.list })
            await expect(list).toBeVisible()
            await expect(list.getByRole('listitem')).toHaveCount(1)
            await expect(list.getByRole('listitem')).toHaveText(tab.empty)
            await expect(page.getByRole('table')).toHaveCount(0)
            await expectFitsWidth(list, 390)
        }
    })
})

test.describe('desktop (1920px)', () => {
    test.use({ viewport: { width: 1920, height: 1080 } })

    test('every profile tab keeps its full table', async ({ page, isMobile }) => {
        test.skip(isMobile)
        await page.goto(`/players/${USER_ID}`)

        for (const tab of TABS) {
            await openTab(page, tab)
            const table = page.getByRole('table')
            await expect(table).toBeVisible()
            await expect(page.getByRole('list', { name: tab.list })).toHaveCount(0)
            for (const header of tab.headers) {
                await expect(table.getByRole('columnheader', { name: header, exact: true })).toBeVisible()
            }
            await expect(table.getByRole('columnheader')).toHaveCount(tab.headers.length)
            await expect(table.locator('tbody tr')).toHaveCount(2)
        }
    })
})
