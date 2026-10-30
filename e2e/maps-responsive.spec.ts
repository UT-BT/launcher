import { expect, test, type Page } from '@playwright/test'
import { mockApi } from './sidebarRail'
import { horizontalOverflow } from './layout'

const AUTH_KEY = 'utbt:webAuth:v1'
const TUTORIAL_KEY = 'utbt:mapsPageTutorial:v1'
const PHONE = { width: 390, height: 844 }
const MID = { width: 1024, height: 800 }
const WIDE = { width: 1920, height: 1080 }

const MAPS = [
    { name: 'CTF-BT-Alpha', added: '2024-03-01', difficulty: 3, active: true, tags: 'Fun', author: 'Mapper One', required_players: 1, world_record: 42.5 },
    { name: 'CTF-BT-BravoWithAVeryLongMapNameThatMustNotOverflow', added: '2024-02-01', difficulty: 8, active: true, tags: 'Hard,Long', author: 'Mapper Two', required_players: 1, world_record: 125.25 },
    { name: 'CTF-BT-Charlie', added: '2024-01-01', difficulty: 5, active: true, author: 'Mapper Three', required_players: 2 },
]

const BEST_CAPS = [
    { map: 'CTF-BT-Alpha', cap_id: 'cap-1', cap_time_seconds: 50.125, cap_type: 2, verified: true },
]

interface MapsApi {
    maps: typeof MAPS
    hold: Promise<void> | null
}

async function openMaps(page: Page, options: { maps?: typeof MAPS; signedIn?: boolean; hold?: Promise<void> } = {}): Promise<MapsApi> {
    const api: MapsApi = { maps: options.maps ?? MAPS, hold: options.hold ?? null }
    await page.addInitScript(({ authKey, tutorialKey, signedIn }) => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem(tutorialKey, JSON.stringify({ seen: true, version: 1 }))
        if (!signedIn) return
        localStorage.setItem(authKey, JSON.stringify({
            discordId: '100',
            username: 'tester',
            avatar: '',
            accessToken: 'token',
            refreshToken: 'refresh-token',
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        }))
    }, { authKey: AUTH_KEY, tutorialKey: TUTORIAL_KEY, signedIn: options.signedIn ?? false })
    await mockApi(page)
    await page.route(/https:\/\/api\.utbt\.net\/.*/, async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, '')
        const ok = (data: unknown) => route.fulfill({ json: { success: true, data } }).catch(() => undefined)

        if (path === '/users/me') return ok({ id: '100', alias: 'Tester', utbt_role: 0 })
        if (path === '/maps') {
            if (api.hold) await api.hold
            return ok(api.maps)
        }
        if (path === '/maps/count') return ok({ count: api.maps.length })
        if (path === '/caps/capped_maps/100') return ok(BEST_CAPS)
        return route.fallback()
    })
    await page.goto('/maps')
    return api
}

function mapCards(page: Page) {
    return page.getByRole('list', { name: 'Maps' })
}

test.describe('Maps page card rows', () => {
    test.beforeEach(({ isMobile }) => {
        test.skip(!isMobile, 'phone layout runs on mobile-chromium')
    })

    test('shows card rows with the map name and core data at 390 px', async ({ page }) => {
        await page.setViewportSize(PHONE)
        await openMaps(page)

        const cards = mapCards(page)
        await expect(cards).toBeVisible()
        await expect(page.getByRole('table')).toHaveCount(0)
        await expect(cards.getByRole('listitem')).toHaveCount(MAPS.length)

        const alpha = cards.getByRole('listitem').filter({ hasText: 'Alpha' })
        await expect(alpha.getByText('00:42.500')).toBeVisible()
        await expect(alpha.getByText('Mapper One')).toBeVisible()
        await expect(alpha.getByText('3', { exact: true })).toBeVisible()
        await expect(alpha.getByRole('button', { name: 'Favorite CTF-BT-Alpha' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Columns' })).toHaveCount(0)

        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        const listOverflow = await cards.evaluate(el => el.scrollWidth - el.clientWidth)
        expect(listOverflow).toBeLessThanOrEqual(1)
    })

    test('signed in, a card also shows the personal best', async ({ page }) => {
        await page.setViewportSize(PHONE)
        await openMaps(page, { signedIn: true })

        const alpha = mapCards(page).getByRole('listitem').filter({ hasText: 'Alpha' })
        await expect(alpha.getByText('00:50.125')).toBeVisible()
        await expect(alpha.getByText('00:42.500')).toBeVisible()
        await expect(page.getByRole('table')).toHaveCount(0)
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    })

    test('the loading state is card skeletons with no overflow', async ({ page }) => {
        await page.setViewportSize(PHONE)
        let release: () => void = () => undefined
        const hold = new Promise<void>(resolve => { release = resolve })
        await openMaps(page, { hold })

        const cards = mapCards(page)
        await expect(cards).toBeVisible()
        await expect(cards.locator('[data-utbt-map-card-skeleton]').first()).toBeVisible()
        await expect(cards.getByRole('listitem')).toHaveCount(0)
        await expect(page.getByRole('table')).toHaveCount(0)
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)

        release()
        await expect(cards.getByRole('listitem')).toHaveCount(MAPS.length)
    })

    test('the empty state reads inside the card list with no overflow', async ({ page }) => {
        await page.setViewportSize(PHONE)
        await openMaps(page, { maps: [] })

        const cards = mapCards(page)
        await expect(cards.getByText('No maps match your filters.')).toBeVisible()
        await expect(page.getByRole('table')).toHaveCount(0)
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    })
})

test.describe('Maps page table', () => {
    test.beforeEach(({ isMobile }) => {
        test.skip(isMobile, 'wide layouts run on desktop-chromium')
    })

    test('the table is unchanged at 1920 px', async ({ page }) => {
        await page.setViewportSize(WIDE)
        await openMaps(page)

        const table = page.getByRole('table')
        await expect(table).toBeVisible()
        await expect(mapCards(page)).toHaveCount(0)
        await expect(table.getByRole('row')).toHaveCount(MAPS.length + 1)
        const headers = await table.locator('thead th').allInnerTexts()
        expect(headers.map(h => h.trim())).toEqual([
            '', 'Map', 'Events & Tags', 'Author', 'Difficulty', 'Added', 'World Record', '', 'Community Review',
        ])
        await expect(page.getByRole('button', { name: 'Columns' })).toBeVisible()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    })

    test('signed in at 1920 px the table keeps every column', async ({ page }) => {
        await page.setViewportSize(WIDE)
        await openMaps(page, { signedIn: true })

        const table = page.getByRole('table')
        await expect(table.getByText('00:50.125')).toBeVisible()
        const headers = await table.locator('thead th').allInnerTexts()
        expect(headers.map(h => h.trim())).toEqual([
            '', 'Map', 'Events & Tags', 'Author', 'Difficulty', 'Added', 'World Record', 'Medal', 'Personal Best', '',
            'Community Review', 'Your Review',
        ])
    })

    test('mid width keeps the core columns in the table', async ({ page }) => {
        await page.setViewportSize(MID)
        await openMaps(page, { signedIn: true })

        const table = page.getByRole('table')
        await expect(table).toBeVisible()
        await expect(mapCards(page)).toHaveCount(0)
        const headers = (await table.locator('thead th').allInnerTexts()).map(h => h.trim())
        for (const core of ['Map', 'Difficulty', 'World Record', 'Personal Best']) {
            expect(headers).toContain(core)
        }
        const longName = table.getByText('BravoWithAVeryLongMapNameThatMustNotOverflow', { exact: true })
        const spill = await longName.evaluate(el => {
            const cell = el.closest('td') as HTMLElement
            return el.getBoundingClientRect().right - cell.getBoundingClientRect().right
        })
        expect(spill).toBeLessThanOrEqual(0)
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        const tableOverflow = await table.evaluate(el => {
            const shell = el.parentElement as HTMLElement
            return shell.scrollWidth - shell.clientWidth
        })
        expect(tableOverflow).toBeLessThanOrEqual(1)
    })
})
