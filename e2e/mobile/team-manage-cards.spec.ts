import { expect, test, type Locator, type Page } from '@playwright/test'
import { reopenOnDroppedModule } from './dev-server'
import { serveFixtureSet } from './fixtures/router'
import { crawlSurfaces, surfaceSteps } from './manifest'
import { eventDetailManager } from './manifest/event-detail-manager'
import { CONSENT_KEY } from './manifest/overlays'
import { modalHeading } from './manifest/steps'
import { teamDetail } from './manifest/team-detail'
import type { MobileRouteEntry } from './manifest/types'
import { settleLayout } from './settle'

const PHONE = { width: 390, height: 844 }
const DESKTOP_WIDTH = { width: 1920, height: 1080 }
const MIN_CLEARANCE_PX = 16
const CONTROLS = 'a, button, input, select, textarea, label, summary, [role="button"], [role="link"]'

async function open(page: Page, entry: MobileRouteEntry, surfaceId: string) {
    await page.addInitScript(storage => {
        for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value)
    }, { [CONSENT_KEY]: 'denied', ...entry.storage })
    await serveFixtureSet(page, entry.fixtures!)
    const surface = crawlSurfaces('pr').find(candidate => candidate.id === surfaceId)
    if (!surface) throw new Error(`no crawl surface for ${surfaceId}`)
    const { path, steps } = surfaceSteps(surface)
    await reopenOnDroppedModule(page, async () => {
        await page.goto(path)
        for (const step of steps) await step(page)
    })
    await settleLayout(page)
}

async function tapCardBody(page: Page, card: Locator) {
    await card.scrollIntoViewIfNeeded()
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
    await page.touchscreen.tap(best.x, best.y)
}

async function cardsShown(scope: Locator, name: string): Promise<Locator> {
    const list = scope.getByRole('list', { name })
    await expect(list, `${name} render as cards`).toBeVisible()
    await expect(scope.getByRole('table')).toHaveCount(0)
    return list.getByRole('listitem')
}

async function openPanel(card: Locator) {
    const chevron = card.getByRole('button', { name: 'Details' })
    await chevron.tap()
    await expect(chevron).toHaveAttribute('aria-expanded', 'true')
}

function panelValue(card: Locator, label: string): Locator {
    return card.getByRole('term').filter({ hasText: new RegExp(`^${label}$`) }).locator('xpath=following-sibling::dd[1]')
}

function sortControlsOf(list: Locator) {
    const control = list.locator('xpath=preceding-sibling::div[1]')
    return {
        field: control.getByRole('combobox', { name: 'Sort by' }),
        direction: control.getByRole('button', { name: /^(Ascending|Descending)$/ }),
    }
}

test.describe('Team tables, manage matches and pick/ban queue cards', () => {
    test.use({ viewport: PHONE, contextOptions: { screen: PHONE } })

    test('a team world record card shows holder, map and time, the panel holds difficulty and date, and the body opens the cap', async ({ page }) => {
        await open(page, teamDetail, teamDetail.view)
        const main = page.getByRole('main')
        const card = (await cardsShown(main, 'Team world records')).first()
        await expect(card).toContainText('fierd_2')
        await expect(card).toContainText('Qamariya')
        const timeLink = card.locator('a[href^="/caps/"]').first()
        await expect(timeLink).toBeVisible()

        await openPanel(card)
        await expect(card.getByRole('term')).toHaveText(['Difficulty', 'Date'])
        await expect(panelValue(card, 'Difficulty')).toHaveText('1')

        const href = await timeLink.getAttribute('href')
        await card.getByRole('button', { name: 'Details' }).tap()
        await expect(card.getByRole('term')).toHaveCount(0)
        await tapCardBody(page, card)
        await expect(page).toHaveURL(new RegExp(`${href!}$`))
    })

    test('team world records sort from the cards, and the table header shows the same sort', async ({ page }) => {
        await open(page, teamDetail, teamDetail.view)
        const main = page.getByRole('main')
        await cardsShown(main, 'Team world records')
        const { field, direction } = sortControlsOf(main.getByRole('list', { name: 'Team world records' }))
        await expect(field).toHaveValue('date')
        await expect(direction).toHaveText('Descending')
        await expect(field.getByRole('option')).toHaveText(['Holder', 'Map', 'Difficulty', 'Time', 'Date'])

        const sorted = page.waitForRequest(request => {
            const url = new URL(request.url())
            return url.pathname.startsWith('/v2/world_records') && url.searchParams.get('sort_by') === 'time'
                && url.searchParams.get('sort') === 'asc'
        })
        await field.selectOption('time')
        await sorted
        await expect(direction).toHaveText('Ascending')

        await page.setViewportSize(DESKTOP_WIDTH)
        const records = main.getByRole('table').filter({ has: page.getByRole('columnheader', { name: 'Holder' }) })
        await expect(records.getByRole('columnheader', { name: 'Time' })).toHaveAttribute('aria-sort', 'ascending')
        await expect(records.getByRole('columnheader', { name: 'Date' })).not.toHaveAttribute('aria-sort', /.+/)
    })

    test('a team activity card shows player, type, map and when, the panel holds the result, and the cards sort', async ({ page }) => {
        await open(page, teamDetail, teamDetail.view)
        const main = page.getByRole('main')
        const cards = await cardsShown(main, 'Team activity')
        const first = cards.first()
        await expect(first).toContainText('fierd_2')
        await expect(first).toContainText('Play')
        await expect(first).toContainText('Qamariya')
        await expect(first).toContainText(/ago|now/)
        await openPanel(first)
        await expect(first.getByRole('term')).toHaveText(['Result'])
        await expect(panelValue(first, 'Result')).toHaveText('40m')

        const { field, direction } = sortControlsOf(main.getByRole('list', { name: 'Team activity' }))
        await expect(field).toHaveValue('when')
        await expect(field.getByRole('option')).toHaveText(['Player', 'Type', 'Map', 'When'])
        await field.selectOption('player')
        await expect(direction).toHaveText('Ascending')
        await expect(cards.first()).toContainText('fierd_1')
        await direction.tap()
        await expect(direction).toHaveText('Descending')
        await expect(cards.first()).toContainText('Nightwolf`')

        await page.setViewportSize(DESKTOP_WIDTH)
        const activity = main.getByRole('table').filter({ has: page.getByRole('columnheader', { name: 'Result' }) })
        await expect(activity.getByRole('columnheader', { name: 'Player' })).toHaveAttribute('aria-sort', 'descending')
    })

    test('a team activity card body opens its cap, or its player when the item has no cap', async ({ page }) => {
        await open(page, teamDetail, teamDetail.view)
        const main = page.getByRole('main')
        const cards = await cardsShown(main, 'Team activity')
        const playtime = cards.first()
        await expect(playtime).toContainText('Play')
        const playerHref = await playtime.locator('a[href^="/players/"]').first().getAttribute('href')
        expect(playerHref, 'the card links its player').toBeTruthy()
        await tapCardBody(page, playtime)
        await expect(page).toHaveURL(new RegExp(`${playerHref!}$`))

        await page.goBack()
        const { field } = sortControlsOf(main.getByRole('list', { name: 'Team activity' }))
        await field.selectOption('type')
        const cap = cards.first()
        await expect(cap).toContainText('Cap')
        await openPanel(cap)
        const capHref = await panelValue(cap, 'Result').locator('a[href^="/caps/"]').getAttribute('href')
        expect(capHref, 'the panel links the cap').toBeTruthy()
        await cap.getByRole('button', { name: 'Details' }).tap()
        await expect(cap.getByRole('term')).toHaveCount(0)
        await tapCardBody(page, cap)
        await expect(page).toHaveURL(new RegExp(`${capHref!}$`))
    })

    test('a match card body opens the match page', async ({ page }) => {
        await open(page, eventDetailManager, 'event-detail:manager/matches')
        const section = page.getByRole('region', { name: 'Matches' })
        const card = (await cardsShown(section, 'Matches')).first()
        const href = await card.getByRole('link', { name: 'Picks & Bans' }).getAttribute('href')
        await tapCardBody(page, card)
        await expect(page).toHaveURL(new RegExp(`${href!}$`))
    })

    test('a pick/ban queue card body opens the match page', async ({ page }) => {
        await open(page, eventDetailManager, 'event-detail:manager/pickban')
        const section = page.getByRole('region', { name: 'Match queue' })
        const card = (await cardsShown(section, 'Match queue')).nth(1)
        const href = await card.getByRole('link', { name: 'Open Page' }).getAttribute('href')
        await tapCardBody(page, card)
        await expect(page).toHaveURL(new RegExp(`${href!}$`))
    })

    test('a match card shows match, status and actions; Edit, Picks & Bans and the staff pickers work from the card', async ({ page }) => {
        const writes: { path: string; body: unknown }[] = []
        let chosen = ''
        await open(page, eventDetailManager, 'event-detail:manager/matches')
        await page.route(/\/admin\/matches\/[^/]+\/streamer$/, async route => {
            const body = route.request().postDataJSON() as { user_id: string | null }
            writes.push({ path: new URL(route.request().url()).pathname, body })
            const streamer = body.user_id ? { id: body.user_id, display_name: chosen, twitch_url: null } : null
            await route.fulfill({ json: { success: true, data: { streamer } } })
        })

        const section = page.getByRole('region', { name: 'Matches' })
        const card = (await cardsShown(section, 'Matches')).first()
        const title = (await card.getByText(/ vs /).first().innerText()).trim()
        await expect(card.getByRole('button', { name: 'Edit' })).toBeVisible()
        await expect(card.getByRole('link', { name: 'Picks & Bans' })).toBeVisible()
        await expect(card.getByRole('button', { name: /^Streamer: / })).toHaveCount(0)

        await card.getByRole('button', { name: 'Edit' }).tap()
        await expect(modalHeading(page, title)).toBeVisible()
        await page.getByRole('button', { name: 'Close modal' }).tap()
        await expect(modalHeading(page, title)).toHaveCount(0)

        await openPanel(card)
        await expect(card.getByRole('term')).toHaveText(['Stage / Round', 'Scheduled', 'Match Admin', 'Streamer'])
        await expect(panelValue(card, 'Match Admin').getByRole('button', { name: /^Match admin: / })).toBeVisible()
        const picker = panelValue(card, 'Streamer').getByRole('button', { name: /^Streamer: / })
        await picker.tap()
        const choice = page.getByRole('menu').getByRole('menuitemradio').nth(2)
        chosen = (await choice.innerText()).trim()
        await choice.tap()
        await expect(panelValue(card, 'Streamer').getByRole('button', { name: `Streamer: ${chosen}` })).toBeVisible()
        expect(writes).toHaveLength(1)

        const pickBan = card.getByRole('link', { name: 'Picks & Bans' })
        const href = await pickBan.getAttribute('href')
        await pickBan.tap()
        await expect(page).toHaveURL(new RegExp(`${href!}$`))
    })

    test('a pick/ban queue card shows match, status and actions, and the panel holds stage, schedule, streamer and presence', async ({ page }) => {
        await open(page, eventDetailManager, 'event-detail:manager/pickban')
        const section = page.getByRole('region', { name: 'Match queue' })
        const cards = await cardsShown(section, 'Match queue')
        await expect(cards.nth(2).getByRole('button', { name: 'Open Lobby' })).toBeVisible()
        const lobby = cards.nth(1)
        await expect(lobby.getByText(/ vs /).first()).toBeVisible()
        await expect(lobby.getByText('Lobby', { exact: true })).toBeVisible()
        await expect(lobby.getByRole('link', { name: 'Open Page' })).toBeVisible()
        await expect(lobby.getByRole('button', { name: 'Copy Player Link' })).toBeVisible()
        await expect(lobby.getByRole('button', { name: 'Copy Stream Link' })).toBeVisible()

        await openPanel(lobby)
        await expect(lobby.getByRole('term')).toHaveText(['Stage / Round', 'Scheduled', 'Streamer', 'Ready / Online'])
        await expect(panelValue(lobby, 'Ready / Online')).toHaveText('1/2 · 2 online')
        await expect(panelValue(lobby, 'Streamer').getByRole('button', { name: /^Streamer: / })).toBeVisible()

        const openPage = lobby.getByRole('link', { name: 'Open Page' })
        const href = await openPage.getAttribute('href')
        await openPage.tap()
        await expect(page).toHaveURL(new RegExp(`${href!}$`))
    })
})
