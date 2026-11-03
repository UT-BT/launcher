import { expect, test, type Locator, type Page } from '@playwright/test'
import { reopenOnDroppedModule } from './dev-server'
import { serveFixtureSet } from './fixtures/router'
import { crawlSurfaces, surfaceSteps } from './manifest'
import { admin } from './manifest/admin'
import { CONSENT_KEY } from './manifest/overlays'
import { MODAL_ROOT } from './manifest/types'
import { settleLayout } from './settle'

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1920, height: 1080 }

async function openSection(page: Page, section: string) {
    await page.addInitScript(storage => {
        for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value)
    }, { [CONSENT_KEY]: 'denied', ...admin.storage })
    await serveFixtureSet(page, admin.fixtures!)
    const id = `admin/${section}`
    const surface = crawlSurfaces('pr').find(candidate => candidate.id === id)
    if (!surface) throw new Error(`no crawl surface for ${id}`)
    const { path, steps } = surfaceSteps(surface)
    await reopenOnDroppedModule(page, async () => {
        await page.goto(path)
        for (const step of steps) await step(page)
    })
    await settleLayout(page)
}

async function cardsOf(page: Page, name: string): Promise<Locator> {
    const list = page.getByRole('main').getByRole('list', { name })
    await expect(list, `${name} render as cards`).toBeVisible()
    await expect(list.locator('table')).toHaveCount(0)
    return list.getByRole('listitem')
}

async function modalCardsOf(dialog: Locator, name: string): Promise<Locator> {
    const list = dialog.getByRole('list', { name })
    await expect(list, `${name} render as cards`).toBeVisible()
    await expect(list.locator('table')).toHaveCount(0)
    return list.getByRole('listitem')
}

async function expectNoSidewaysScroll(view: Locator) {
    const overflow = await view.evaluate(element => {
        const shell = element.parentElement ?? element
        return shell.scrollWidth - shell.clientWidth
    })
    expect(overflow).toBeLessThanOrEqual(1)
}

async function centre(card: Locator) {
    await card.evaluate(element => element.scrollIntoView({ block: 'center' }))
}

async function openPanel(card: Locator) {
    await centre(card)
    const chevron = card.getByRole('button', { name: 'Details' })
    const box = await chevron.boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.height).toBeGreaterThanOrEqual(44)
    await chevron.tap()
    await expect(chevron).toHaveAttribute('aria-expanded', 'true')
}

function terms(card: Locator): Locator {
    return card.getByRole('term')
}

function modal(page: Page, title?: string | RegExp): Locator {
    const backdrops = page.locator(MODAL_ROOT)
    return title ? backdrops.filter({ has: page.getByRole('heading', { name: title }) }) : backdrops
}

async function tapCardBody(card: Locator) {
    const cardBox = await card.boundingBox()
    const chevron = await card.getByRole('button', { name: 'Details' }).boundingBox()
    if (!cardBox || !chevron) throw new Error('card or its chevron has no box')
    await card.tap({ position: { x: chevron.x - cardBox.x - 8, y: chevron.y - cardBox.y + chevron.height / 2 } })
}

async function tapFreeSpot(card: Locator) {
    await centre(card)
    const spot = await card.evaluate(element => {
        const controls = 'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [role="checkbox"]'
        const box = element.getBoundingClientRect()
        const face = (element.firstElementChild ?? element).getBoundingClientRect()
        const y = face.top + face.height / 2
        let best = { from: 0, length: 0 }
        let run = { from: 0, length: 0 }
        for (let x = face.left + 2; x < face.right - 52; x += 2) {
            const hit = document.elementFromPoint(x, y)
            const free = !!hit && element.contains(hit) && !hit.closest(controls)
            run = free ? { from: run.length ? run.from : x, length: run.length + 2 } : { from: 0, length: 0 }
            if (run.length > best.length) best = run
        }
        return best.length >= 24 ? { x: best.from + best.length / 2 - box.left, y: y - box.top } : null
    })
    if (!spot) throw new Error('the card face has no spot outside its controls')
    await card.tap({ position: spot })
}

function requested(page: Page, path: RegExp) {
    return page.waitForRequest(request => path.test(new URL(request.url()).pathname))
}

test.describe('Admin cards', () => {
    test.use({ viewport: PHONE, contextOptions: { screen: PHONE } })

    test('User Management: Manage opens the user from the card, the panel holds the rest, and the card sort drives the header sort', async ({ page }) => {
        await openSection(page, 'user-management')
        const cards = await cardsOf(page, 'Players')
        await expect(page.getByRole('button', { name: 'Columns' })).toHaveCount(0)
        const card = cards.first()
        await openPanel(card)
        await expect(terms(card)).toHaveText(['Discord ID', 'Role', 'Status', 'Warnings', 'Bans'])

        const sorted = page.waitForRequest(request => /\/admin\/users\?/.test(request.url()) && new URL(request.url()).searchParams.get('sort') === 'bans')
        await page.getByRole('combobox', { name: 'Sort by' }).selectOption({ label: 'Bans' })
        await sorted
        await expect(page.getByRole('button', { name: 'Descending' })).toBeVisible()

        const detail = requested(page, /\/admin\/users\/\d+$/)
        await cards.first().getByRole('button', { name: 'Manage' }).tap()
        await detail
        await expect(modal(page)).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(modal(page)).toHaveCount(0)

        await page.setViewportSize(DESKTOP)
        await expect(page.getByRole('main').getByRole('columnheader', { name: 'Bans' })).toHaveAttribute('aria-sort', 'descending')
        await expect(page.getByRole('button', { name: 'Columns' })).toBeVisible()
    })

    test('Title Management, Patch Releases and News open their editors from the card actions', async ({ page }) => {
        await openSection(page, 'title-management')
        const titles = await cardsOf(page, 'Titles')
        await openPanel(titles.first())
        await expect(terms(titles.first())).toHaveText(['Rarity', 'Holders'])
        await titles.first().getByRole('button', { name: 'Edit title' }).tap()
        await expect(modal(page, 'Edit title')).toBeVisible()
        await page.keyboard.press('Escape')

        await page.locator('select:has(option[value="patches-management"])').selectOption('patches-management')
        const patches = await cardsOf(page, 'Patches')
        await expect(patches.first()).toContainText('v4.8.0')
        await openPanel(patches.first())
        await expect(terms(patches.first())).toHaveText(['Asset', 'Hashes', 'Notes', 'Added'])
        await patches.first().getByRole('button', { name: 'Edit patch' }).tap()
        await expect(modal(page, /^Edit patch/)).toBeVisible()
        await page.keyboard.press('Escape')

        await page.locator('select:has(option[value="news-management"])').selectOption('news-management')
        const news = await cardsOf(page, 'News')
        await openPanel(news.first())
        await expect(terms(news.first())).toHaveText(['Category', 'Status', 'Pinned', 'Published', 'Expires'])
        await news.first().getByRole('button', { name: 'Edit', exact: true }).tap()
        await expect(modal(page, /^Edit/)).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(modal(page)).toHaveCount(0)

        await news.first().getByText(/^Test announcement 1:/).tap()
        await expect(page).toHaveURL(/\/news\/900$/)
    })

    test('Caps Management keeps row selection usable on the cards and opens the disallow confirm', async ({ page }) => {
        await openSection(page, 'caps-management')
        const cards = await cardsOf(page, 'Caps')
        const first = cards.first().getByRole('checkbox')
        const target = await first.locator('xpath=..').boundingBox()
        expect(target?.width).toBeGreaterThanOrEqual(44)
        const url = page.url()
        await first.tap()
        await expect(first).toBeChecked()
        await expect(page.getByText('1 selected', { exact: true })).toBeVisible()
        expect(page.url()).toBe(url)

        const all = page.getByRole('checkbox', { name: 'Select all caps on this page' })
        await all.tap()
        const count = await cards.count()
        await expect(page.getByText(`${count} selected`, { exact: true })).toBeVisible()
        await all.tap()
        await expect(page.getByText(/\d+ selected/)).toHaveCount(0)

        await openPanel(cards.first())
        await expect(terms(cards.first())).toHaveText(['Map', 'Time', 'Status', 'Added'])
        await cards.nth(1).getByRole('button', { name: 'Disallow' }).tap()
        await expect(modal(page, 'Disallow cap')).toBeVisible()
    })

    test('Usage & Health: the recent user card opens the player', async ({ page }) => {
        await openSection(page, 'usage-health')
        const cards = await cardsOf(page, 'Recent signed-in users')
        await openPanel(cards.first())
        await expect(terms(cards.first())).toHaveText(['Surface', 'Last view', 'Last seen'])
        const url = page.url()
        await tapCardBody(cards.first())
        await expect(page).not.toHaveURL(url)
        await expect(page).toHaveURL(/player/)
    })

    test('Map Uploads: a draft card opens the draft', async ({ page }) => {
        await openSection(page, 'map-uploads')
        const drafts = await cardsOf(page, 'Drafts')
        const baz = drafts.filter({ hasText: 'CTF-BT-Baz' })
        await openPanel(baz)
        await expect(terms(baz)).toHaveText(['Issues', 'Uploaded by', 'Expires'])
        const draft = requested(page, /\/admin\/map-uploads\/drafts\/\d+$/)
        await baz.getByRole('button', { name: 'Open' }).tap()
        await draft
        await expect(page.getByRole('list', { name: 'Drafts' })).toHaveCount(0)
    })

    test('Map Uploads: drift lists every location, and a publish card selects the publish', async ({ page }) => {
        await openSection(page, 'map-uploads')
        await page.getByRole('button', { name: 'Drift', exact: true }).tap()
        const drift = await cardsOf(page, 'Drift')
        const tex = drift.filter({ hasText: 'FooTex.utx' })
        await expect(tex.getByText('eu2', { exact: true })).toBeVisible()
        await openPanel(tex)
        await expect(terms(tex)).toHaveText(['sha256', 'Size', 'Last seen'])
        await expect(tex.getByRole('definition').first()).toContainText('redirect')
        await expect(tex.getByRole('definition').first()).toContainText('eu2')

        await page.getByRole('button', { name: 'Publishing / Recent', exact: true }).tap()
        const publishes = await cardsOf(page, 'Recent publishes')
        const foo = publishes.filter({ hasText: 'CTF-BT-Foo' })
        await openPanel(foo)
        await expect(terms(foo)).toHaveText(['Hosts', 'Created', 'Went live'])
        const publish = requested(page, /\/admin\/map-uploads\/publishes\/\d+$/)
        await foo.getByText('CTF-BT-Foo').tap()
        await publish
    })

    test('Audit Logs: details open in the card panel, and in a DataTable expand row on the table', async ({ page }) => {
        await openSection(page, 'audit-logs')
        const cards = await cardsOf(page, 'Audit entries')
        const card = cards.first()
        await openPanel(card)
        await expect(terms(card)).toHaveText(['Time', 'Actor', 'Action'])
        await expect(card.getByText('IP Address')).toBeVisible()
        await expect(card.getByText('Changes')).toBeVisible()
        await card.getByRole('button', { name: 'Roll back' }).tap()
        await expect(modal(page, 'Roll back this action?')).toBeVisible()
        await modal(page).getByRole('button', { name: 'Cancel' }).tap()
        await expect(modal(page)).toHaveCount(0)

        await page.setViewportSize(DESKTOP)
        const table = page.getByRole('main').getByRole('table')
        await expect(table).toBeVisible()
        await table.getByRole('row').nth(1).click()
        const detail = table.getByRole('row').nth(2)
        await expect(detail.getByText('IP Address')).toBeVisible()
        await expect(detail.getByRole('cell')).toHaveCount(1)
    })

    test('Audit Logs: an actor column hidden on desktop is still listed once in the card panel', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('utbt:admin:audit:cols:v2', JSON.stringify({ hidden: ['actor'] }))
        })
        await openSection(page, 'audit-logs')
        const card = (await cardsOf(page, 'Audit entries')).first()
        await openPanel(card)
        await expect(terms(card)).toHaveText(['Time', 'Actor', 'Action'])
        await expect(card.getByText('Actor', { exact: true })).toHaveCount(1)
        await expect(card.getByText('Action', { exact: true })).toHaveCount(1)
    })

    test('Maps Management: Edit opens the map editor from the card, the card sort drives the header sort, and the body opens the map', async ({ page }) => {
        await openSection(page, 'maps-management')
        const cards = await cardsOf(page, 'Maps')
        await expect(page.getByRole('button', { name: 'Columns' })).toHaveCount(0)
        await openPanel(cards.first())
        await expect(terms(cards.first())).toHaveText(['Author', 'Added', 'Difficulty', 'Players', 'Tags', 'Status', 'Superseded'])

        const sorted = page.waitForRequest(request => /\/admin\/maps\?/.test(request.url()) && new URL(request.url()).searchParams.get('sort') === 'difficulty')
        await page.getByRole('combobox', { name: 'Sort by' }).selectOption({ label: 'Difficulty' })
        await sorted

        await cards.first().getByRole('button', { name: 'Edit map' }).tap()
        await expect(modal(page, /^Edit map/)).toBeVisible()
        await modal(page).getByRole('button', { name: 'Cancel' }).tap()
        await expect(modal(page)).toHaveCount(0)

        const url = page.url()
        await tapFreeSpot(cards.first())
        await expect(page).not.toHaveURL(url)
        await expect(page).toHaveURL(/CTF-BT-/)
    })

    test('Maps Management: Difficulty Sync keeps its selection usable on the cards', async ({ page }) => {
        await openSection(page, 'maps-management')
        await page.getByRole('button', { name: 'Sync Difficulties' }).tap()
        const dialog = modal(page, 'Sync map difficulties')
        const cards = await modalCardsOf(dialog, 'Proposed changes')
        await expect(cards).toHaveCount(6)
        await expect(dialog.getByRole('button', { name: 'Apply 6 changes' })).toBeVisible()

        const box = cards.first().getByRole('checkbox')
        const target = await box.locator('xpath=..').boundingBox()
        expect(target?.width).toBeGreaterThanOrEqual(44)
        await box.tap()
        await expect(box).not.toBeChecked()
        await expect(dialog.getByRole('button', { name: 'Apply 5 changes' })).toBeVisible()

        const all = dialog.getByRole('checkbox', { name: 'Select all' })
        await all.tap()
        await expect(dialog.getByRole('button', { name: 'Apply 6 changes' })).toBeVisible()
        await all.tap()
        await expect(dialog.getByRole('button', { name: 'Apply 0 changes' })).toBeDisabled()

        await openPanel(cards.first())
        await expect(terms(cards.first())).toHaveText(['Avg (reviews)'])
    })

    test('Map Authors: Review and Unlink work from the cards, and the review and re-credit lists fit the phone', async ({ page }) => {
        await openSection(page, 'maps-management')
        await page.getByRole('button', { name: 'Authors', exact: true }).tap()
        const dialog = modal(page, 'Map authors')
        const linkedTab = dialog.getByRole('button', { name: 'Linked players' })
        await linkedTab.tap()
        const linked = await modalCardsOf(dialog, 'Linked players')
        await openPanel(linked.first())
        await expect(terms(linked.first())).toHaveText(['Was'])
        await page.route(/\/admin\/maps\/authors\/unlink$/, route => route.fulfill({ json: { success: true, data: { ok: true, unlinked_count: 3, maps: [] } } }))
        const unlinked = page.waitForRequest(request => request.method() === 'POST' && /\/admin\/maps\/authors\/unlink$/.test(new URL(request.url()).pathname))
        await linked.first().getByRole('button', { name: 'Unlink' }).tap()
        expect((await unlinked).postDataJSON()).toMatchObject({ author_str: 'Test Mapper 41' })
        await expect(dialog.getByText('Unlinked 3 map(s) back to "Test Mapper 41".')).toBeVisible()

        await dialog.getByRole('button', { name: 'Unlinked names' }).tap()
        const names = await modalCardsOf(dialog, 'Unlinked names')
        await expect(names.first()).toContainText('Test Mapper 1')
        await expect(names.first()).toContainText(/\d+ maps/)
        await openPanel(names.first())
        await expect(terms(names.first())).toHaveText(['Notes'])
        await names.first().getByRole('button', { name: 'Review' }).tap()

        const review = modal(page, 'Review "Test Mapper 1"')
        await expect(review.getByRole('button', { name: 'Continue with 5 maps' })).toBeVisible()
        const reviewList = review.locator('table, [role="list"]').first()
        await expect(reviewList).toBeVisible()
        await expectNoSidewaysScroll(reviewList)
        await review.getByRole('checkbox', { name: /^Include / }).first().tap()
        await expect(review.getByRole('button', { name: 'Continue with 4 maps' })).toBeVisible()
        await review.getByRole('button', { name: 'Continue with 4 maps' }).tap()

        const pick = modal(page, 'Link "Test Mapper 1"')
        await pick.getByPlaceholder('Search players…').fill('Amber')
        await pick.getByRole('listitem').getByRole('button').first().tap()
        await expect(pick.getByRole('button', { name: 'Link 4 maps' })).toBeVisible()
        const recredit = pick.locator('table, [role="list"]').first()
        await expect(recredit).toBeVisible()
        await expectNoSidewaysScroll(recredit)
        await expect(recredit).toContainText('Active')
    })

    test('Anti-Cheat: a shared identifier card opens its detail, whose cap cards open the cap', async ({ page }) => {
        await openSection(page, 'anti-cheat')
        const cards = await cardsOf(page, 'Shared identifiers')
        await openPanel(cards.first())
        await expect(terms(cards.first())).toHaveText(['Shared by', 'Caps', 'Last seen'])
        await tapFreeSpot(cards.first())

        const dialog = modal(page, 'HWID detail')
        const caps = await modalCardsOf(dialog, 'Caps on this identifier')
        await openPanel(caps.first())
        await expect(terms(caps.first())).toHaveText(['Map', 'Time', 'Status', 'Added'])
        const url = page.url()
        await tapFreeSpot(caps.first())
        await expect(page).not.toHaveURL(url)
        await expect(modal(page)).toHaveCount(0)
    })

    test('Anti-Cheat: High Cap Delta keeps row selection on the cards, sorts from the card sort, and opens the cap stats', async ({ page }) => {
        await openSection(page, 'anti-cheat-cap-delta')
        const cards = await cardsOf(page, 'High cap delta runs')
        const first = cards.first().getByRole('checkbox', { name: 'Select cap' })
        const target = await first.locator('xpath=..').boundingBox()
        expect(target?.width).toBeGreaterThanOrEqual(44)
        const url = page.url()
        await first.tap()
        await expect(first).toBeChecked()
        await expect(page.getByText('1 selected', { exact: true })).toBeVisible()
        expect(page.url()).toBe(url)
        await expect(modal(page)).toHaveCount(0)

        const all = page.getByRole('checkbox', { name: 'Select all caps on this page' })
        await all.tap()
        await expect(page.getByText(`${await cards.count()} selected`, { exact: true })).toBeVisible()
        await all.tap()
        await expect(page.getByText(/\d+ selected/)).toHaveCount(0)

        await openPanel(cards.first())
        await expect(terms(cards.first())).toHaveText(['Map', 'Time', 'Delta', 'Added'])
        await cards.first().getByRole('button', { name: 'Disallow cap' }).tap()
        await expect(modal(page, 'Disallow cap')).toBeVisible()
        await modal(page).getByRole('button', { name: 'Cancel' }).tap()
        await expect(modal(page)).toHaveCount(0)

        const sorted = page.waitForRequest(request => /\/admin\/anti-cheat\/cap-delta\?/.test(request.url()) && new URL(request.url()).searchParams.get('sort') === 'added')
        await page.getByRole('combobox', { name: 'Sort by' }).selectOption({ label: 'Added' })
        await sorted

        await tapFreeSpot(cards.nth(1))
        const stats = modal(page, 'Cap stats')
        const buckets = await modalCardsOf(stats, 'Frame rate and ping percentiles')
        await expect(buckets).toHaveCount(4)
        await expect(buckets.first()).toContainText('1%')
        await expect(buckets.first()).toContainText('FPS')
        await expect(buckets.first()).toContainText('Ping')
        await expect(buckets.first().getByRole('button', { name: 'Details' })).toHaveCount(0)
    })

    test('Anti-Cheat: Low FPS WRs keeps row selection on the cards and opens the allow confirm', async ({ page }) => {
        await openSection(page, 'anti-cheat-low-fps')
        const cards = await cardsOf(page, 'Low FPS world records')
        const first = cards.first().getByRole('checkbox', { name: 'Select cap' })
        await first.tap()
        await expect(first).toBeChecked()
        await expect(page.getByText('1 selected', { exact: true })).toBeVisible()
        await expect(modal(page)).toHaveCount(0)

        await openPanel(cards.first())
        await expect(terms(cards.first())).toHaveText(['Map', 'Time', '1%', '5%', '25%', '50%', 'Limits', 'Spawns', 'Risk'])
        await cards.first().getByRole('button', { name: 'Mark legitimate (allow list)' }).tap()
        await expect(modal(page, 'Mark cap as legitimate')).toBeVisible()
    })
})
