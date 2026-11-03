import { expect, test, type Page } from '@playwright/test'
import { mockApi } from './sidebarRail'
import { horizontalOverflow } from './layout'

const AUTH_KEY = 'utbt:webAuth:v1'
const TUTORIAL_KEY = 'utbt:mapsPageTutorial:v1'
const PHONE = { width: 390, height: 844 }
const NARROW = { width: 360, height: 780 }
const MID = { width: 1024, height: 800 }
const DESKTOP = { width: 1280, height: 800 }
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

function mapCard(page: Page, name: string) {
    return mapCards(page).getByRole('listitem').filter({ hasText: name })
}

async function cardOrder(page: Page): Promise<string[]> {
    const texts = await mapCards(page).getByRole('listitem').allInnerTexts()
    return texts.map(text => ['Alpha', 'Bravo', 'Charlie'].find(name => text.includes(name)) ?? text)
}

async function headerTexts(page: Page): Promise<string[]> {
    return (await page.getByRole('table').locator('thead th').allInnerTexts()).map(h => h.trim())
}

function tutorial(page: Page) {
    return page.getByRole('dialog', { name: 'Maps page tutorial' })
}

async function tutorialTo(page: Page, title: string) {
    await page.getByRole('button', { name: 'Restart Maps tutorial' }).click()
    const card = tutorial(page)
    await expect(card).toBeVisible()
    const heading = card.getByRole('heading')
    for (let step = 0; step < 12; step++) {
        const current = (await heading.textContent()) ?? ''
        if (current === title) return
        await card.getByRole('button', { name: 'Next' }).click()
        await expect(heading).not.toHaveText(current)
    }
    await expect(card.getByRole('heading', { name: title })).toBeVisible()
}

function modal(page: Page) {
    return page.locator('[data-modal-backdrop]')
}

function spotlit(page: Page) {
    return page.locator('[data-tutorial-highlight]')
}

test.describe('Maps page card rows', () => {
    test.beforeEach(({ isMobile }) => {
        test.skip(!isMobile, 'phone layout runs on mobile-chromium')
    })

    test('a card shows the thumbnail, name, difficulty and world record, and the rest behind Details at 390 px', async ({ page }) => {
        await page.setViewportSize(PHONE)
        await openMaps(page)

        const cards = mapCards(page)
        await expect(cards).toBeVisible()
        await expect(page.getByRole('table')).toHaveCount(0)
        await expect(cards.getByRole('listitem')).toHaveCount(MAPS.length)

        const alpha = mapCard(page, 'Alpha')
        await expect(alpha.getByRole('img', { name: 'CTF-BT-Alpha' })).toBeVisible()
        await expect(alpha.getByText('00:42.500')).toBeVisible()
        await expect(alpha.getByText('3', { exact: true })).toBeVisible()
        await expect(alpha.getByRole('button', { name: 'Favorite CTF-BT-Alpha' })).toBeVisible()
        await expect(alpha.getByText('Mapper One')).toHaveCount(0)
        await expect(alpha.getByRole('button', { name: 'Demos' })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Columns' })).toHaveCount(0)

        const details = alpha.getByRole('button', { name: 'Details' })
        const box = await details.boundingBox()
        expect(box?.width).toBeGreaterThanOrEqual(44)
        expect(box?.height).toBeGreaterThanOrEqual(44)
        await details.tap()
        await expect(details).toHaveAttribute('aria-expanded', 'true')
        for (const label of ['Tags', 'Author', 'Added', 'Demos', 'Community Review']) {
            await expect(alpha.getByRole('term').filter({ hasText: label })).toBeVisible()
        }
        await expect(alpha.getByText('Mapper One')).toBeVisible()
        await expect(alpha.getByText('Fun', { exact: true })).toBeVisible()
        await expect(alpha.getByText('Mar 01, 2024')).toBeVisible()
        await expect(alpha.getByRole('button', { name: 'Demos' })).toBeVisible()
        await expect(alpha.getByRole('button', { name: 'No reviews, add one?' })).toBeVisible()
        await expect(alpha.getByRole('term').filter({ hasText: 'Your Review' })).toHaveCount(0)

        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        const listOverflow = await cards.evaluate(el => el.scrollWidth - el.clientWidth)
        expect(listOverflow).toBeLessThanOrEqual(1)
    })

    test('signed in, a card also shows the medal and personal best, and the panel holds your review', async ({ page }) => {
        await page.setViewportSize(PHONE)
        await openMaps(page, { signedIn: true })

        const alpha = mapCard(page, 'Alpha')
        await expect(alpha.getByText('00:50.125')).toBeVisible()
        await expect(alpha.getByText('00:42.500')).toBeVisible()
        await expect(alpha.getByRole('img', { name: 'Certified' })).toBeVisible()
        await expect(page.getByRole('table')).toHaveCount(0)

        await alpha.getByRole('button', { name: 'Details' }).tap()
        await expect(alpha.getByRole('term').filter({ hasText: 'Your Review' })).toBeVisible()
        await expect(alpha.getByRole('button', { name: 'Review this map' })).toBeVisible()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    })

    test('signed in at 360 px the map name keeps almost half the card width', async ({ page }) => {
        await page.setViewportSize(NARROW)
        await openMaps(page, { signedIn: true })

        const bravo = mapCard(page, 'Bravo')
        const name = await bravo.getByRole('link', { name: 'BravoWithAVeryLongMapNameThatMustNotOverflow' }).boundingBox()
        const card = await bravo.boundingBox()
        if (!name || !card) throw new Error('the Bravo card has no name link')
        expect(name.width).toBeGreaterThanOrEqual(card.width * 0.45)
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    })

    test('demos and community review open from a card\'s expand panel', async ({ page }) => {
        await page.setViewportSize(PHONE)
        await openMaps(page)

        const alpha = mapCard(page, 'Alpha')
        await alpha.getByRole('button', { name: 'Details' }).tap()
        await alpha.getByRole('button', { name: 'Demos' }).tap()
        const replays = modal(page).getByRole('heading', { name: 'Replays — Alpha' })
        await expect(replays).toBeVisible()
        await modal(page).getByRole('button', { name: 'Close modal' }).tap()
        await expect(replays).toHaveCount(0)

        await alpha.getByRole('button', { name: 'No reviews, add one?' }).tap()
        await expect(modal(page).getByRole('heading', { name: 'Reviews for Alpha' })).toBeVisible()
        await expect(page).toHaveURL(/\/maps$/)
    })

    test('tapping the card body opens the map', async ({ page }) => {
        await page.setViewportSize(PHONE)
        await openMaps(page)

        const alpha = mapCard(page, 'Alpha')
        const bar = await alpha.getByText('3', { exact: true }).locator('xpath=..').boundingBox()
        const times = await alpha.getByText('WR', { exact: true }).locator('xpath=../..').boundingBox()
        if (!bar || !times) throw new Error('the card face has no difficulty or times')
        await page.touchscreen.tap((bar.x + bar.width + times.x) / 2, bar.y + bar.height / 2)
        await expect(page).toHaveURL(/\/maps\/CTF-BT-Alpha$/)
    })

    test('the card sort changes the order, and the direction button reverses it', async ({ page }) => {
        await page.setViewportSize(PHONE)
        await openMaps(page)

        await expect(mapCards(page).getByRole('listitem')).toHaveCount(MAPS.length)
        expect(await cardOrder(page)).toEqual(['Alpha', 'Bravo', 'Charlie'])

        const field = page.getByLabel('Sort by')
        const options = (await field.locator('option').allInnerTexts()).map(o => o.trim())
        expect(options).toEqual(['Map', 'Author', 'Difficulty', 'Added', 'World Record', 'Community Review'])

        await field.selectOption({ label: 'Author' })
        await expect.poll(() => cardOrder(page)).toEqual(['Alpha', 'Charlie', 'Bravo'])

        await page.getByRole('button', { name: 'Ascending' }).tap()
        await expect(page.getByRole('button', { name: 'Descending' })).toBeVisible()
        await expect.poll(() => cardOrder(page)).toEqual(['Bravo', 'Charlie', 'Alpha'])
    })

    test('signed in, the card sort lists all nine sortable columns', async ({ page }) => {
        await page.setViewportSize(PHONE)
        await openMaps(page, { signedIn: true })

        await expect(mapCards(page).getByRole('listitem')).toHaveCount(MAPS.length)
        const options = (await page.getByLabel('Sort by').locator('option').allInnerTexts()).map(o => o.trim())
        expect(options).toEqual([
            'Map', 'Author', 'Difficulty', 'Added', 'World Record', 'Medal Earned', 'Personal Best',
            'Community Review', 'Your Review',
        ])
    })

    test('the tutorial spotlights the card sort and the first card\'s demos and reviews', async ({ page }) => {
        await page.setViewportSize(PHONE)
        await openMaps(page, { signedIn: true })
        await expect(mapCards(page).getByRole('listitem')).toHaveCount(MAPS.length)

        await tutorialTo(page, 'Sort maps')
        await expect(spotlit(page).getByLabel('Sort by')).toBeVisible()

        const card = tutorial(page)
        await card.getByRole('button', { name: 'Next' }).click()
        await expect(spotlit(page).getByRole('button', { name: 'Favorite CTF-BT-Alpha' })).toBeVisible()

        for (const title of ['Watch the world record', 'Watch your own runs', 'Watch demos']) {
            await card.getByRole('button', { name: 'Next' }).click()
            await expect(card.getByRole('heading', { name: title })).toBeVisible()
        }
        await expect(spotlit(page)).toHaveText('Demos')
        await expect(spotlit(page)).toBeInViewport()

        await card.getByRole('button', { name: 'Next' }).click()
        await expect(card.getByRole('heading', { name: 'Map ratings' })).toBeVisible()
        await expect(spotlit(page)).toHaveCount(2)
        await expect(spotlit(page).first()).toHaveText('9')
    })

    test('re-sorting during the tutorial opens the new first card for the demos step', async ({ page }) => {
        await page.setViewportSize(PHONE)
        await openMaps(page)
        await expect(mapCards(page).getByRole('listitem')).toHaveCount(MAPS.length)

        await tutorialTo(page, 'Sort maps')
        await spotlit(page).getByLabel('Sort by').selectOption({ label: 'Author' })
        await page.getByRole('button', { name: 'Ascending' }).click()
        await expect.poll(() => cardOrder(page)).toEqual(['Bravo', 'Charlie', 'Alpha'])

        const card = tutorial(page)
        for (const title of ['Favorite maps', 'Watch the world record', 'Watch your own runs', 'Watch demos']) {
            await card.getByRole('button', { name: 'Next' }).click()
            await expect(card.getByRole('heading', { name: title })).toBeVisible()
        }
        await expect(spotlit(page)).toHaveText('Demos')
        await expect(spotlit(page)).toBeInViewport()
    })

    test('the loading state is card skeletons with no overflow', async ({ page }) => {
        await page.setViewportSize(PHONE)
        let release: () => void = () => undefined
        const hold = new Promise<void>(resolve => { release = resolve })
        await openMaps(page, { hold })

        const cards = mapCards(page)
        await expect(cards).toBeVisible()
        await expect(cards.locator('[data-utbt-map-card-skeleton]').first()).toBeVisible()
        await expect(cards.getByRole('button', { name: 'Details' })).toHaveCount(0)
        await expect(page.getByRole('table')).toHaveCount(0)
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)

        release()
        await expect(cards.getByRole('button', { name: 'Details' })).toHaveCount(MAPS.length)
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
        expect(await headerTexts(page)).toEqual([
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
        expect(await headerTexts(page)).toEqual([
            '', 'Map', 'Events & Tags', 'Author', 'Difficulty', 'Added', 'World Record', 'Medal', 'Personal Best', '',
            'Community Review', 'Your Review',
        ])
    })

    const DROPPED = [
        { size: DESKTOP, signedIn: false, headers: ['', 'Map', 'Events & Tags', 'Author', 'Difficulty', 'World Record', ''] },
        { size: MID, signedIn: false, headers: ['Map', 'Author', 'Difficulty', 'World Record', ''] },
        { size: DESKTOP, signedIn: true, headers: ['', 'Map', 'Author', 'Difficulty', 'World Record', 'Medal', 'Personal Best', ''] },
        { size: MID, signedIn: true, headers: ['', 'Map', 'Difficulty', 'World Record', 'Medal', 'Personal Best'] },
    ]
    for (const { size, signedIn, headers } of DROPPED) {
        test(`${signedIn ? 'signed in' : 'signed out'} at ${size.width} px the table drops the same columns as before`, async ({ page }) => {
            await page.setViewportSize(size)
            await openMaps(page, { signedIn })
            await expect(page.getByRole('table').getByRole('row')).toHaveCount(MAPS.length + 1)
            expect(await headerTexts(page)).toEqual(headers)
        })
    }

    test('the tutorial still spotlights the sort header and the first row\'s demos', async ({ page }) => {
        await page.setViewportSize(WIDE)
        await openMaps(page)
        await expect(page.getByRole('table').getByText('00:42.500')).toBeVisible()

        await tutorialTo(page, 'Sort columns')
        await expect(spotlit(page)).toHaveText('Map')
        const card = tutorial(page)
        for (const title of ['Favorite maps', 'Watch the world record', 'Watch your own runs', 'Watch demos']) {
            await card.getByRole('button', { name: 'Next' }).click()
            await expect(card.getByRole('heading', { name: title })).toBeVisible()
        }
        await expect(spotlit(page)).toHaveText('Demos')
    })

    test('signed in, a narrow desktop window still switches to cards', async ({ page }) => {
        await page.setViewportSize({ width: 600, height: 800 })
        await openMaps(page, { signedIn: true })

        await expect(mapCards(page).getByRole('listitem')).toHaveCount(MAPS.length)
        await expect(page.getByRole('table')).toHaveCount(0)
    })

    test('mid width keeps the core columns in the table', async ({ page }) => {
        await page.setViewportSize(MID)
        await openMaps(page, { signedIn: true })

        const table = page.getByRole('table')
        await expect(table).toBeVisible()
        await expect(mapCards(page)).toHaveCount(0)
        const headers = await headerTexts(page)
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
