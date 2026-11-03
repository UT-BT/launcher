import { expect, test, type Locator, type Page } from '@playwright/test'
import { reopenOnDroppedModule } from './dev-server'
import { serveFixtureSet } from './fixtures/router'
import { crawlSurfaces, surfaceSteps } from './manifest'
import { capItAll } from './manifest/cap-it-all'
import { CONSENT_KEY } from './manifest/overlays'
import { players } from './manifest/players'
import { servers } from './manifest/servers'
import type { MobileRouteEntry } from './manifest/types'
import { settleLayout } from './settle'

const PHONE = { width: 390, height: 844 }
const LANDSCAPE_PHONE = { width: 844, height: 390 }
const DESKTOP_WIDTH = { width: 1920, height: 1080 }

async function open(page: Page, entry: MobileRouteEntry) {
    await page.addInitScript(storage => {
        for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value)
    }, { [CONSENT_KEY]: 'denied', ...entry.storage })
    await serveFixtureSet(page, entry.fixtures!)
    const surface = crawlSurfaces('pr').find(candidate => candidate.id === entry.view)
    if (!surface) throw new Error(`no crawl surface for ${entry.view}`)
    const { path, steps } = surfaceSteps(surface)
    await reopenOnDroppedModule(page, async () => {
        await page.goto(path)
        for (const step of steps) await step(page)
    })
    await settleLayout(page)
}

async function cardsShown(page: Page, name: string): Promise<Locator> {
    const list = page.getByRole('main').getByRole('list', { name })
    await expect(list, `${name} render as cards`).toBeVisible()
    await expect(page.getByRole('main').getByRole('table')).toHaveCount(0)
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

test.describe('Players, Cap It All and Servers cards', () => {
    test.use({ viewport: PHONE, contextOptions: { screen: PHONE } })

    test('the server card face keeps name, map, players, flag and status, and the panel lists player and spectator names', async ({ page }) => {
        await open(page, servers)
        const cards = await cardsShown(page, 'Servers')
        const card = cards.filter({ hasText: 'FuriumMineCE2' }).filter({ hasText: '2/2' })
        await expect(card).toHaveCount(1)
        await expect(card.getByRole('button', { name: /^Favorite / })).toBeVisible()
        await expect(card.getByRole('img', { name: 'United Kingdom' })).toBeVisible()
        await expect(card.getByText('2/2', { exact: true })).toBeVisible()
        await expect(card.getByText('gxls')).toHaveCount(0)

        await openPanel(card)
        await expect(card.getByRole('term')).toHaveText(['Type', 'Players', 'Spectators'])
        const playerList = panelValue(card, 'Players')
        await expect(playerList.getByText('gxls', { exact: true })).toBeVisible()
        await expect(playerList.getByText('NinThomas', { exact: true })).toBeVisible()
        const spectatorList = panelValue(card, 'Spectators')
        await expect(spectatorList.getByText('2', { exact: true })).toBeVisible()
        await expect(spectatorList.getByText('UTBT Spectator Bot')).toHaveCount(2)
        await expect(panelValue(card, 'Type')).toHaveText('Certified')

        const spectated = cards.filter({ hasText: 'AztecCE' }).filter({ hasText: 'Certified #6' })
        await openPanel(spectated)
        await expect(panelValue(spectated, 'Spectators').getByText('ch3kz', { exact: true })).toBeVisible()
        await expect(panelValue(spectated, 'Players')).toHaveText('0/2')
    })

    test('servers sort by a field picked on the cards, and the table header shows the same sort', async ({ page }) => {
        await open(page, servers)
        const cards = await cardsShown(page, 'Servers')
        const field = page.getByRole('combobox', { name: 'Sort by' })
        const direction = page.getByRole('button', { name: /^(Ascending|Descending)$/ })
        await expect(field).toHaveValue('players')
        await expect(direction).toHaveText('Descending')
        await expect(cards.first()).toContainText('2/2')

        await field.selectOption('name')
        await expect(direction).toHaveText('Ascending')
        await expect(cards.first()).toContainText('Casual #1')
        await direction.tap()
        await expect(direction).toHaveText('Descending')
        await expect(cards.first()).toContainText('Duel #2')

        await page.setViewportSize(DESKTOP_WIDTH)
        await expect(page.getByRole('main').getByRole('columnheader', { name: 'Server' })).toHaveAttribute('aria-sort', 'descending')
        await expect(page.getByRole('main').getByRole('columnheader', { name: 'Players' })).not.toHaveAttribute('aria-sort', /.+/)
    })

    test('players sort by a field picked on the cards, and the face holds rank, player, points and world records', async ({ page }) => {
        await open(page, players)
        const cards = await cardsShown(page, 'Players')
        const first = cards.first()
        await expect(first).toContainText('#1')
        await expect(first).toContainText('pts')
        await expect(first).toContainText('WRs')
        await openPanel(first)
        await expect(first.getByRole('term')).toHaveText(['Role', 'Champion', 'Gold', 'Silver', 'Bronze', 'Member Since'])
        await expect(panelValue(first, 'Champion')).toHaveText(/^\d[\d,]*$/)
        await expect(panelValue(first, 'Member Since')).not.toBeEmpty()

        const field = page.getByRole('combobox', { name: 'Sort by' })
        const direction = page.getByRole('button', { name: /^(Ascending|Descending)$/ })
        await expect(field).toHaveValue('rank')
        await expect(direction).toHaveText('Ascending')
        await expect(field.getByRole('option')).toHaveText([
            'Rank', 'Player', 'Points', 'World Records', 'Champion', 'Gold', 'Silver', 'Bronze', 'Member Since',
        ])

        const sorted = page.waitForRequest(request => {
            const url = new URL(request.url())
            return url.pathname.startsWith('/v2/players') && url.searchParams.get('sort') === 'world_records'
                && url.searchParams.get('order') === 'desc'
        })
        await field.selectOption('world_records')
        await sorted
        await expect(direction).toHaveText('Descending')

        await page.setViewportSize(DESKTOP_WIDTH)
        await expect(page.getByRole('main').getByRole('columnheader', { name: 'World Records' })).toHaveAttribute('aria-sort', 'descending')
    })

    test('the Cap It All face keeps the total and certified percentage, and the panel holds the other breakdowns', async ({ page }) => {
        await open(page, capItAll)
        const card = (await cardsShown(page, 'Cap It All leaderboard')).first()
        await expect(page.getByRole('combobox', { name: 'Sort by' })).toHaveCount(0)
        await expect(card).toContainText(/Certified \d+\.\d{2}%/)
        await openPanel(card)
        await expect(card.getByRole('term')).toHaveText(['Certified', 'Non-certified', 'Team Maps'])
    })

    test('tapping a player or Cap It All card body opens the player', async ({ page }) => {
        for (const [entry, name] of [[players, 'Players'], [capItAll, 'Cap It All leaderboard']] as const) {
            await open(page, entry)
            const card = (await cardsShown(page, name)).first()
            const href = await card.locator('a[href^="/players/"]').first().getAttribute('href')
            expect(href, `${name}: the card links its player`).toBeTruthy()
            await card.getByText('#1', { exact: true }).tap()
            await expect(page).toHaveURL(new RegExp(`${href!}$`))
        }
    })
})

test.describe('Players on a landscape phone', () => {
    test.use({ viewport: LANDSCAPE_PHONE, contextOptions: { screen: LANDSCAPE_PHONE } })

    test('the table keeps its shown columns instead of switching to cards for the hidden ones', async ({ page }) => {
        await open(page, players)
        const table = page.getByRole('main').getByRole('table')
        await expect(table).toBeVisible()
        await expect(page.getByRole('main').getByRole('list', { name: 'Players' })).toHaveCount(0)
        await expect(table.getByRole('columnheader')).toHaveCount(5)
        await expect(table.getByRole('columnheader', { name: 'Member Since' })).toHaveCount(0)
    })
})
