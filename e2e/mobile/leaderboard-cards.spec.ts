import { expect, test, type Locator, type Page } from '@playwright/test'
import { reopenOnDroppedModule } from './dev-server'
import { serveFixtureSet } from './fixtures/router'
import { crawlSurfaces, surfaceSteps } from './manifest'
import { mapsDetail } from './manifest/maps-detail'
import { CONSENT_KEY } from './manifest/overlays'
import { modalHeading, watchesReplay } from './manifest/steps'
import { settleLayout } from './settle'

const PHONE = { width: 390, height: 844 }
const DESKTOP_WIDTH = { width: 1920, height: 1080 }
const SOLO_PANEL = ['Team', 'Date', 'Watch replay', 'Download demo']
const TEAM_PANEL = ['Status', 'Date']

async function openSurface(page: Page, surfaceId: string) {
    await page.addInitScript(key => localStorage.setItem(key, 'denied'), CONSENT_KEY)
    await serveFixtureSet(page, mapsDetail.fixtures)
    const surface = crawlSurfaces('pr').find(candidate => candidate.id === surfaceId)
    if (!surface) throw new Error(`no crawl surface for ${surfaceId}`)
    const { path, steps } = surfaceSteps(surface)
    await reopenOnDroppedModule(page, async () => {
        await page.goto(path)
        for (const step of steps) await step(page)
    })
    await settleLayout(page)
}

async function leaderboardCards(page: Page, name: string): Promise<Locator> {
    const list = page.getByRole('main').getByRole('list', { name })
    await expect(list, `${name} renders as cards`).toBeVisible()
    await expect(page.getByRole('main').getByRole('table')).toHaveCount(0)
    return list.getByRole('listitem')
}

async function openDetails(card: Locator) {
    const chevron = card.getByRole('button', { name: 'Details' })
    await chevron.tap()
    await expect(chevron).toHaveAttribute('aria-expanded', 'true')
}

async function shownRanks(cards: Locator): Promise<number[]> {
    const texts = await cards.getByText(/^#\d+$/).allInnerTexts()
    return texts.map(text => Number(text.slice(1)))
}

test.describe('Map leaderboard cards', () => {
    test.use({ viewport: PHONE, contextOptions: { screen: PHONE } })

    test('a solo card shows rank, player, medal and time, and its panel holds team, date, watch and download', async ({ page }) => {
        await openSurface(page, mapsDetail.view)
        const card = (await leaderboardCards(page, 'Map leaderboard')).first()
        await expect(card.getByText('#1', { exact: true })).toBeVisible()
        await expect(card.locator('a[href^="/caps/"]')).toBeVisible()
        await expect(card.getByRole('term')).toHaveCount(0)

        await openDetails(card)
        await expect(card.getByRole('term')).toHaveText(SOLO_PANEL)
        const panel = card.getByRole('definition')
        await expect(panel.locator('button:has(.lucide-download)')).toBeVisible()
        await expect(panel.locator('button:has(.lucide-play), button:has(.lucide-message-square-off)')).toBeVisible()
    })

    test('Watch opens the replay from a card panel', async ({ page }) => {
        await openSurface(page, mapsDetail.view)
        const cards = await leaderboardCards(page, 'Map leaderboard')
        const count = await cards.count()
        for (let index = 0; index < count; index += 1) await openDetails(cards.nth(index))
        await watchesReplay(() => page.getByRole('list', { name: 'Map leaderboard' }).getByRole('definition'))(page)
        await expect(modalHeading(page, /^Replay —/)).toBeVisible()
    })

    test('Download fetches the demo from a card panel', async ({ page }) => {
        const demoRequests: string[] = []
        await openSurface(page, mapsDetail.view)
        await page.route(/https:\/\/api\.utbt\.net\/demos\//, async route => {
            demoRequests.push(new URL(route.request().url()).pathname)
            await route.fulfill({ contentType: 'application/octet-stream', body: Buffer.from('demo') })
        })
        const card = (await leaderboardCards(page, 'Map leaderboard')).first()
        const capHref = await card.locator('a[href^="/caps/"]').getAttribute('href')
        const capId = capHref!.split('/').pop()

        await openDetails(card)
        await card.getByRole('definition').locator('button:has(.lucide-download)').tap()
        await expect(modalHeading(page, 'Demo Downloaded')).toBeVisible()
        expect(demoRequests).toEqual([`/demos/${capId}`])
    })

    test('the solo leaderboard sorts in card mode, and the table header keeps that sort', async ({ page }) => {
        await openSurface(page, mapsDetail.view)
        const cards = await leaderboardCards(page, 'Map leaderboard')
        const field = page.getByRole('combobox', { name: 'Sort by' })
        const direction = page.getByRole('button', { name: /^(Ascending|Descending)$/ })
        await expect(field).toHaveValue('rank')
        await expect(direction).toHaveText('Ascending')
        const ascending = await shownRanks(cards)
        expect(ascending.length, 'the leaderboard has several cards').toBeGreaterThan(1)
        expect(ascending).toEqual([...ascending].sort((a, b) => a - b))

        await direction.tap()
        await expect(direction).toHaveText('Descending')
        await expect(cards.first().getByText('#1', { exact: true })).toHaveCount(0)
        const descending = await shownRanks(cards)
        expect(descending).toEqual([...descending].sort((a, b) => b - a))

        await field.selectOption('date')
        await expect(field).toHaveValue('date')
        await expect(direction).toHaveText('Descending')

        await page.setViewportSize(DESKTOP_WIDTH)
        const main = page.getByRole('main')
        await expect(main.getByRole('columnheader', { name: 'Date' })).toHaveAttribute('aria-sort', 'descending')
        await expect(main.getByRole('columnheader', { name: '#' })).not.toHaveAttribute('aria-sort', /.+/)
    })

    test('a team card shows rank, team, medal and time, with status and date in its panel and a sort control', async ({ page }) => {
        await openSurface(page, `${mapsDetail.view}/team-map`)
        const card = (await leaderboardCards(page, 'Team leaderboard')).first()
        await expect(card.getByText('#1', { exact: true })).toBeVisible()
        await expect(card.locator('a[href^="/team-caps/"]')).toBeVisible()
        await openDetails(card)
        await expect(card.getByRole('term')).toHaveText(TEAM_PANEL)

        const field = page.getByRole('combobox', { name: 'Sort by' })
        await expect(field).toHaveValue('rank')
        await expect(field.getByRole('option')).toHaveText(['Rank', 'Team Time', 'Date'])
    })

    test('tapping a solo or team card body opens its cap', async ({ page }) => {
        for (const [surfaceId, name, capLink] of [
            [mapsDetail.view, 'Map leaderboard', 'a[href^="/caps/"]'],
            [`${mapsDetail.view}/team-map`, 'Team leaderboard', 'a[href^="/team-caps/"]'],
        ] as const) {
            await openSurface(page, surfaceId)
            const card = (await leaderboardCards(page, name)).first()
            const href = await card.locator(capLink).getAttribute('href')
            expect(href, `${name}: the card links its cap`).toBeTruthy()
            await card.getByText('#1', { exact: true }).tap()
            await expect(page).toHaveURL(new RegExp(`${href!}$`))
        }
    })
})
