import { expect, test, type Locator, type Page } from '@playwright/test'
import { reopenOnDroppedModule } from './dev-server'
import { serveFixtureSet } from './fixtures/router'
import { crawlSurfaces, surfaceSteps } from './manifest'
import { CONSENT_KEY } from './manifest/overlays'
import { worldRecords } from './manifest/world-records'
import { settleLayout } from './settle'

const PHONE = { width: 390, height: 844 }
const DESKTOP_WIDTH = { width: 1920, height: 1080 }
const MIN_TAP_PX = 44
const MIN_CLEARANCE_PX = 16
const CONTROLS = 'a, button, input, select, textarea, label, summary, [role="button"], [role="link"]'

interface Point {
    x: number
    y: number
}

async function openWorldRecords(page: Page, surfaceId = worldRecords.view) {
    await page.addInitScript(key => localStorage.setItem(key, 'denied'), CONSENT_KEY)
    await serveFixtureSet(page, worldRecords.fixtures)
    const surface = crawlSurfaces('pr').find(candidate => candidate.id === surfaceId)
    if (!surface) throw new Error(`no crawl surface for ${surfaceId}`)
    const { path, steps } = surfaceSteps(surface)
    await reopenOnDroppedModule(page, async () => {
        await page.goto(path)
        for (const step of steps) await step(page)
    })
    await settleLayout(page)
}

async function freePointOn(card: Locator): Promise<Point> {
    const best = await card.evaluate((element, controls) => {
        const box = element.getBoundingClientRect()
        const targets = [...element.querySelectorAll(controls)].map(control => control.getBoundingClientRect())
        const clearance = (x: number, y: number) => Math.min(...targets.map(rect => Math.hypot(
            Math.max(rect.left - x, 0, x - rect.right),
            Math.max(rect.top - y, 0, y - rect.bottom),
        )))
        let found: { x: number; y: number; clearance: number } | null = null
        for (let y = box.top + 4; y < box.bottom - 4; y += 4) {
            for (let x = box.left + 4; x < box.right - 4; x += 4) {
                const hit = document.elementFromPoint(x, y)
                if (!hit || !element.contains(hit) || hit.closest(controls)) continue
                const room = clearance(x, y)
                if (!found || room > found.clearance) found = { x, y, clearance: room }
            }
        }
        return found
    }, CONTROLS)
    if (!best) throw new Error('the card has no spot outside its controls')
    expect(best.clearance, 'a spot on the card body clear of its controls').toBeGreaterThanOrEqual(MIN_CLEARANCE_PX)
    return best
}

async function cardsShown(page: Page, name: string): Promise<Locator> {
    const list = page.getByRole('main').getByRole('list', { name })
    await expect(list, `${name} render as cards`).toBeVisible()
    await expect(page.getByRole('main').getByRole('table')).toHaveCount(0)
    return list.getByRole('listitem')
}

test.describe('World Records cards', () => {
    test.use({ viewport: PHONE, contextOptions: { screen: PHONE } })

    test('the expand chevron is a 44 px target that opens the panel in place, and the card body opens the map', async ({ page }) => {
        await openWorldRecords(page)
        const card = (await cardsShown(page, 'World records')).first()
        const chevron = card.getByRole('button', { name: 'Details' })
        const box = await chevron.boundingBox()
        expect(box, 'the chevron is rendered').not.toBeNull()
        expect(box!.width, 'chevron width').toBeGreaterThanOrEqual(MIN_TAP_PX)
        expect(box!.height, 'chevron height').toBeGreaterThanOrEqual(MIN_TAP_PX)

        const startUrl = page.url()
        await chevron.tap()
        await expect(chevron).toHaveAttribute('aria-expanded', 'true')
        const panel = card.getByRole('definition')
        await expect(card.getByRole('term')).toHaveText(['Difficulty', 'Date Set', 'Actions'])
        await expect(panel).toHaveCount(3)
        await expect(card.getByRole('button', { name: 'View world record history' })).toBeVisible()
        expect(page.url(), 'tapping the chevron stays on World Records').toBe(startUrl)

        await chevron.tap()
        await expect(chevron).toHaveAttribute('aria-expanded', 'false')
        await expect(card.getByRole('term')).toHaveCount(0)

        const mapHref = await card.locator('a[href^="/maps/"]').first().getAttribute('href')
        expect(mapHref, 'the card links its map').toBeTruthy()
        const spot = await freePointOn(card)
        await page.touchscreen.tap(spot.x, spot.y)
        await expect(page).toHaveURL(new RegExp(`${mapHref!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
    })

    test('a sort and an open card chosen on the cards survive widening to the table and back', async ({ page }) => {
        await openWorldRecords(page)
        const cards = await cardsShown(page, 'World records')
        const openDetails = page.getByRole('main').getByRole('button', { name: 'Details', expanded: true })
        const columnsMenu = page.getByRole('main').getByRole('button', { name: 'Columns' })
        await expect(columnsMenu, 'the column menu stays hidden on cards').toHaveCount(0)
        const field = page.getByRole('combobox', { name: 'Sort by' })
        const direction = page.getByRole('button', { name: /^(Ascending|Descending)$/ })
        await expect(field).toHaveValue('date')
        await expect(direction).toHaveText('Descending')

        await field.selectOption('time')
        await expect(field).toHaveValue('time')
        await expect(direction).toHaveText('Descending')
        await direction.tap()
        await expect(direction).toHaveText('Ascending')
        await cards.first().getByRole('button', { name: 'Details' }).tap()
        await expect(openDetails).toHaveCount(1)

        await page.setViewportSize(DESKTOP_WIDTH)
        const header = page.getByRole('main').getByRole('columnheader', { name: 'Time' })
        await expect(header).toHaveAttribute('aria-sort', 'ascending')
        await expect(page.getByRole('main').getByRole('columnheader', { name: 'Date Set' })).not.toHaveAttribute('aria-sort', /.+/)
        await expect(columnsMenu, 'the column menu is back with the table').toBeVisible()

        await page.setViewportSize(PHONE)
        await cardsShown(page, 'World records')
        await expect(field).toHaveValue('time')
        await expect(direction).toHaveText('Ascending')
        await expect(openDetails).toHaveCount(1)
        await expect(cards.first().getByRole('button', { name: 'Details' })).toHaveAttribute('aria-expanded', 'true')
    })

    test('an open record card closes once the view switches to Top Rushers and back', async ({ page }) => {
        await openWorldRecords(page)
        const cards = await cardsShown(page, 'World records')
        const openDetails = page.getByRole('main').getByRole('button', { name: 'Details', expanded: true })
        await cards.first().getByRole('button', { name: 'Details' }).tap()
        await expect(openDetails).toHaveCount(1)

        await page.getByRole('button', { name: 'Top Rushers', exact: true }).tap()
        await cardsShown(page, 'Top rushers')
        await expect(openDetails).toHaveCount(0)

        await page.getByRole('button', { name: 'Records', exact: true }).tap()
        await cardsShown(page, 'World records')
        await expect(openDetails).toHaveCount(0)
    })

    test('Top Rushers cards hold median and average in the panel, and the card body opens the rusher', async ({ page }) => {
        await openWorldRecords(page, `${worldRecords.view}/rushers`)
        const card = (await cardsShown(page, 'Top rushers')).first()
        await expect(page.getByRole('combobox', { name: 'Sort by' })).toHaveCount(0)
        const chevron = card.getByRole('button', { name: 'Details' })
        await chevron.tap()
        await expect(card.getByRole('term')).toHaveText(['Median WR', 'Average WR'])
        await chevron.tap()

        const playerHref = await card.locator('a[href^="/players/"]').first().getAttribute('href')
        expect(playerHref, 'the card links its rusher').toBeTruthy()
        const spot = await freePointOn(card)
        await page.touchscreen.tap(spot.x, spot.y)
        await expect(page).toHaveURL(new RegExp(`${playerHref!}$`))
    })
})

for (const size of [{ width: 430, height: 932 }, { width: 440, height: 956 }]) {
    test.describe(`${size.width}x${size.height}`, () => {
        test.use({ viewport: size, contextOptions: { screen: size } })

        test('World Records shows cards one per row, not a cut-down table', async ({ page }) => {
            await openWorldRecords(page)
            const cards = await cardsShown(page, 'World records')
            const [first, second] = [await cards.nth(0).boundingBox(), await cards.nth(1).boundingBox()]
            expect(second!.y, 'the second card sits below the first').toBeGreaterThanOrEqual(first!.y + first!.height - 1)
        })
    })
}

for (const size of [{ width: 744, height: 1133 }, { width: 844, height: 390 }]) {
    test.describe(`${size.width}x${size.height}`, () => {
        test.use({ viewport: size, contextOptions: { screen: size } })

        test('World Records and Top Rushers lay their cards out two per row', async ({ page }) => {
            await openWorldRecords(page)
            for (const name of ['World records', 'Top rushers']) {
                if (name === 'Top rushers') {
                    await page.getByRole('button', { name: 'Top Rushers' }).tap()
                    await expect(page.getByRole('main').getByRole('list', { name })).toBeVisible()
                    await settleLayout(page)
                }
                const cards = await cardsShown(page, name)
                const [first, second] = [await cards.nth(0).boundingBox(), await cards.nth(1).boundingBox()]
                expect(Math.abs(second!.y - first!.y), `${name}: the first two cards share a row`).toBeLessThanOrEqual(1)
                expect(second!.x, `${name}: the second card sits right of the first`).toBeGreaterThanOrEqual(first!.x + first!.width - 1)
            }
        })
    })
}
