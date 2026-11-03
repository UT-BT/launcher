import { expect, test, type Locator, type Page } from '@playwright/test'
import type { Map as ApiMap, PlaytimeByMapRow, Record as WorldRecord, UserCapRow, UserPersonalBestRow } from '../app/utils/api'
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

function cap(id: string, mapName: string, medal: string, verified: boolean, team: boolean): UserCapRow {
    return {
        id,
        mapName,
        author: 'Mapper',
        difficulty: 4,
        time: verified ? 52.25 : 97.5,
        medal,
        added: verified ? '2026-03-05T12:00:00Z' : '2026-01-15T12:00:00Z',
        verified,
        disallowed: false,
        cap_type: verified ? 2 : 1,
        isTeam: team,
        teamMembers: team ? [{ userId: USER_ID, alias: 'Tester', activeTitle: null }, { userId: '2', alias: 'Partner', activeTitle: null }] : null,
        teamCapId: team ? `team-${id}` : null,
    }
}

function personalBest(row: UserCapRow): UserPersonalBestRow {
    const { disallowed: _disallowed, disallowed_at: _at, disallow_reason: _reason, timeAgo: _ago, ...best } = row
    return best
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

const CAPS = [cap('a1', LONG_MAP, 'Bronze Medal', false, true), cap('a2', SHORT_MAP, 'Gold Medal', true, false)]
const PERSONAL_BESTS = CAPS.map(personalBest)
const DISALLOWED = [
    disallowedCap('c1', LONG_MAP, 'Used a movement exploit through the second gate that skips most of the route'),
    disallowedCap('c2', SHORT_MAP, null),
]
const WORLD_RECORDS = [worldRecord('w1', LONG_MAP, 41.27), worldRecord('w2', SHORT_MAP, 1234.5)]
const PLAYTIME = [playtime(LONG_MAP, 360_000, 1250), playtime(SHORT_MAP, 1800, 3)]
const UNCAPPED = [mapRow(LONG_MAP, 7), mapRow(SHORT_MAP, 2)]
const AUTHORED = [mapRow(LONG_MAP, 5), mapRow(SHORT_MAP, 1)]

const PROGRESSION = [
    { cap_id: 'w2', user_id: USER_ID, alias: 'Tester', cap_time_seconds: 1234.5, added: '2026-02-10T08:30:00Z', active_title: null },
]

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
    headersAt1280: string[]
    empty: string
    card: string
    face: string[]
    panel: [label: string, value: string | null][]
    sortBy: string
    sortRequest: SortRequest | null
}

interface SortRequest {
    path: string
    field: [param: string, value: string]
    direction: string
}

const SHORT = SHORT_MAP.replace(/^CTF-BT-/, '')

const TABS: ProfileTab[] = [
    {
        button: /^All Caps/,
        list: 'Caps',
        headers: ['Map', 'Medal', 'Time', 'Status', 'Date', 'Actions'],
        headersAt1280: ['Map', 'Medal', 'Time', 'Status', 'Date'],
        empty: 'No caps yet.',
        card: SHORT,
        face: ['00:52.250', 'Mar 05, 2026', 'Verified'],
        panel: [['Actions', null]],
        sortBy: 'Map',
        sortRequest: { path: `/v2/summary/user/${USER_ID}/caps`, field: ['sort', 'map'], direction: 'order' },
    },
    {
        button: /^Disallowed/,
        list: 'Disallowed caps',
        headers: ['Map', 'Time', 'Reason', 'Disallowed'],
        headersAt1280: ['Map', 'Time', 'Disallowed'],
        empty: 'No disallowed caps.',
        card: 'AnExtremelyLong',
        face: ['01:23.512', 'Used a movement exploit'],
        panel: [['Disallowed', 'Mar 02, 2026']],
        sortBy: 'Time',
        sortRequest: { path: `/v2/summary/user/${USER_ID}/caps`, field: ['sort', 'time'], direction: 'order' },
    },
    {
        button: /^Personal Bests/,
        list: 'Personal bests',
        headers: ['Map', 'Medal', 'PB Time', 'Status', 'Set', 'Actions'],
        headersAt1280: ['Map', 'PB Time', 'Status', 'Set'],
        empty: 'No personal bests yet.',
        card: SHORT,
        face: ['00:52.250', 'Mar 05, 2026', 'Verified'],
        panel: [['Actions', null]],
        sortBy: 'Set',
        sortRequest: { path: `/v2/summary/user/${USER_ID}/personal_bests`, field: ['sort', 'added'], direction: 'order' },
    },
    {
        button: /^World Records/,
        list: 'World records',
        headers: ['Map', 'Time', 'Set', 'History'],
        headersAt1280: ['Map', 'Time', 'Set', 'History'],
        empty: 'No world records held.',
        card: SHORT,
        face: ['20:34.500', 'Feb 10, 2026'],
        panel: [],
        sortBy: 'Map',
        sortRequest: { path: '/v2/world_records', field: ['sort_by', 'map'], direction: 'sort' },
    },
    {
        button: /^Playtime by Map/,
        list: 'Playtime by map',
        headers: ['Map', 'Time', 'Sessions', 'Last Played'],
        headersAt1280: ['Map', 'Time', 'Sessions', 'Last Played'],
        empty: 'No playtime recorded.',
        card: SHORT,
        face: ['30 m'],
        panel: [['Sessions', '3'], ['Last Played', 'Apr 01, 2026']],
        sortBy: 'Sessions',
        sortRequest: { path: `/playtime/by_map/${USER_ID}`, field: ['sort', 'sessions'], direction: 'order' },
    },
    {
        button: /^Uncapped Maps/,
        list: 'Uncapped maps',
        headers: ['Map', 'Author', 'Difficulty'],
        headersAt1280: ['Map', 'Author', 'Difficulty'],
        empty: 'All caught up — no uncapped maps.',
        card: SHORT,
        face: ['2'],
        panel: [['Author', 'A Mapper With A Rather Long Credited Name']],
        sortBy: 'Difficulty',
        sortRequest: { path: `/caps/uncapped/${USER_ID}`, field: ['sort', 'difficulty'], direction: 'order' },
    },
    {
        button: /^Maps Authored/,
        list: 'Authored maps',
        headers: ['Map', 'Difficulty', 'Added'],
        headersAt1280: ['Map', 'Difficulty', 'Added'],
        empty: 'No maps in rotation are linked to this player.',
        card: SHORT,
        face: ['1'],
        panel: [['Added', 'Nov 20, 2025']],
        sortBy: 'Difficulty',
        sortRequest: null,
    },
]

function apiPath(url: URL): string {
    return decodeURIComponent(url.pathname).replace(/\/$/, '')
}

function isSortRequest(url: URL, sort: SortRequest, direction: string): boolean {
    const [param, value] = sort.field
    return url.hostname === 'api.utbt.net' && apiPath(url) === sort.path
        && url.searchParams.get(param) === value && url.searchParams.get(sort.direction) === direction
}

function emptyTabRead(url: URL): unknown {
    const path = apiPath(url)
    if (path === `/v2/summary/user/${USER_ID}/caps`) return { total: 0, items: [] }
    if (path === `/v2/summary/user/${USER_ID}/personal_bests`) return { total: 0, items: [] }
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
        const path = apiPath(url)
        const ok = (data: unknown) => route.fulfill({ json: { success: true, data } })

        if (path === `/v2/summary/user/${USER_ID}`) return ok(SUMMARY)
        if (path === `/v2/summary/user/${USER_ID}/caps`) {
            const items = url.searchParams.get('cap_filter') === 'disallowed' ? DISALLOWED : CAPS
            return ok({ total: items.length, items })
        }
        if (path === `/v2/summary/user/${USER_ID}/personal_bests`) return ok({ total: PERSONAL_BESTS.length, items: PERSONAL_BESTS })
        if (path === `/v2/summary/user/${USER_ID}/activity`) return ok({ items: [] })
        if (path.startsWith('/v2/world_records/progression/')) return ok(PROGRESSION)
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

function cardOf(page: Page, tab: ProfileTab): Locator {
    return page.getByRole('list', { name: tab.list }).getByRole('listitem').filter({ hasText: tab.card })
}

async function headerTexts(table: Locator): Promise<string[]> {
    return (await table.getByRole('columnheader').allTextContents()).map(text => text.trim())
}

test.describe('phone (390px)', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('every profile tab shows its essential fields on the card face and the rest in the panel', async ({ page, isMobile }) => {
        test.skip(!isMobile)
        await page.goto(`/players/${USER_ID}`)

        for (const tab of TABS) {
            await openTab(page, tab)
            const list = page.getByRole('list', { name: tab.list })
            await expect(list).toBeVisible()
            await expect(list.getByRole('listitem')).toHaveCount(2)
            await expect(page.getByRole('table')).toHaveCount(0)
            await expectFitsWidth(list, 390)
            expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)

            const card = cardOf(page, tab)
            for (const text of tab.face) await expect(card).toContainText(text)
            const chevron = card.getByRole('button', { name: 'Details' })
            if (!tab.panel.length) {
                await expect(chevron).toHaveCount(0)
                continue
            }
            for (const [label] of tab.panel) await expect(card).not.toContainText(label)
            const url = page.url()
            await chevron.tap()
            await expect(chevron).toHaveAttribute('aria-expanded', 'true')
            const panel = page.locator(`[id="${await chevron.getAttribute('aria-controls')}"]`)
            await expect(panel.locator('dt')).toHaveText(tab.panel.map(([label]) => label))
            for (const [label, value] of tab.panel) {
                if (value) await expect(panel).toContainText(value)
                if (label === 'Actions') await expect(panel.getByRole('button')).toHaveCount(2)
            }
            expect(page.url()).toBe(url)
            await expectFitsWidth(list, 390)
        }
    })

    test('the card face shows the medal and the panel offers the replay actions', async ({ page, isMobile }) => {
        test.skip(!isMobile)
        await page.goto(`/players/${USER_ID}`)

        for (const tab of TABS.filter(t => t.panel.some(([label]) => label === 'Actions'))) {
            await openTab(page, tab)
            const card = cardOf(page, tab)
            await expect(card.getByRole('img', { name: 'Gold Medal' })).toBeVisible()
            await card.getByRole('button', { name: 'Details' }).tap()
            const panel = page.locator(`[id="${await card.getByRole('button', { name: 'Details' }).getAttribute('aria-controls')}"]`)
            await expect(panel.getByRole('button').first()).toBeEnabled()
        }
    })

    test('the World Records card opens the record history', async ({ page, isMobile }) => {
        test.skip(!isMobile)
        await page.goto(`/players/${USER_ID}`)
        const tab = TABS.find(t => t.list === 'World records')!
        await openTab(page, tab)
        const url = page.url()
        const history = cardOf(page, tab).getByRole('button', { name: 'View WR progression' })
        const box = await history.boundingBox()
        expect(box?.width).toBeGreaterThanOrEqual(44)
        expect(box?.height).toBeGreaterThanOrEqual(44)
        await history.tap()
        await expect(page.getByText(/^World Record Progression/)).toBeVisible()
        expect(page.url()).toBe(url)
    })

    test('every profile tab sorts in card mode and keeps the sort in the table', async ({ page, isMobile }) => {
        test.skip(!isMobile)
        await page.goto(`/players/${USER_ID}`)

        for (const tab of TABS) {
            await page.setViewportSize({ width: 390, height: 844 })
            await openTab(page, tab)
            await expect(page.getByRole('list', { name: tab.list })).toBeVisible()
            const sortBy = page.getByLabel('Sort by')
            await sortBy.selectOption({ label: tab.sortBy })
            await expect(sortBy.locator('option:checked')).toHaveText(tab.sortBy)
            const direction = page.getByRole('button', { name: /^(Ascending|Descending)$/ })
            const picked = (await direction.textContent())!.trim()
            const flipped = picked === 'Ascending' ? 'Descending' : 'Ascending'
            const cards = page.getByRole('list', { name: tab.list }).getByRole('listitem')
            const sort = tab.sortRequest
            const refetch = sort && page.waitForRequest(request =>
                isSortRequest(new URL(request.url()), sort, flipped === 'Ascending' ? 'asc' : 'desc'))
            const before = await cards.allTextContents()
            await direction.tap()
            await expect(direction).toHaveText(flipped)
            if (refetch) await refetch
            else await expect.poll(() => cards.allTextContents()).toEqual([...before].reverse())

            await page.setViewportSize({ width: 1920, height: 1080 })
            const header = page.getByRole('table').getByRole('columnheader', { name: tab.sortBy, exact: true })
            await expect(header).toHaveAttribute('aria-sort', flipped.toLowerCase())
        }
    })

    test('every profile tab shows a skeleton card while its list loads', async ({ page, isMobile }) => {
        test.skip(!isMobile)
        await page.route(/https:\/\/api\.utbt\.net\/.*/, async route => {
            if (emptyTabRead(new URL(route.request().url())) === undefined) return route.fallback()
        })
        await page.goto(`/players/${USER_ID}`)

        for (const tab of TABS) {
            await openTab(page, tab)
            const list = page.getByRole('list', { name: tab.list })
            await expect(list).toBeVisible()
            await expect(list.getByRole('listitem')).toHaveCount(1)
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
            await expect(page.getByLabel('Sort by')).toHaveCount(0)
            for (const header of tab.headers) {
                await expect(table.getByRole('columnheader', { name: header, exact: true })).toBeVisible()
            }
            await expect(table.getByRole('columnheader')).toHaveCount(tab.headers.length)
            await expect(table.locator('tbody tr')).toHaveCount(2)
        }
    })
})

test.describe('desktop (1280px)', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('every profile tab drops the same columns as before', async ({ page, isMobile }) => {
        test.skip(isMobile)
        await page.goto(`/players/${USER_ID}`)

        for (const tab of TABS) {
            await openTab(page, tab)
            const table = page.getByRole('table')
            await expect(table).toBeVisible()
            await expect.poll(() => headerTexts(table)).toEqual(tab.headersAt1280)
            await expect(table.locator('tbody tr')).toHaveCount(2)
        }
    })
})
