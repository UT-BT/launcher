import { expect, test, type Locator, type Page } from '@playwright/test'
import type { PredictionLeaderboard } from '../../app/utils/api'
import { reopenOnDroppedModule } from './dev-server'
import { serveFixtureSet } from './fixtures/router'
import { person } from './fixtures/synthetic/people'
import { crawlSurfaces, surfaceSteps, type CrawlSurface } from './manifest'
import { EVENT_TEAM_ID, eventTeam } from './manifest/event-team'
import { CONSENT_KEY } from './manifest/overlays'
import { RULE_CHECKS } from './rules'
import { installProbe } from './rules/probe'
import { settleLayout } from './settle'
import { crawlViewports, type Engine } from './viewports'

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1920, height: 1080 }
const TABLE_RULES = ['table-shows-every-column', 'cards-expose-every-column'] as const

const LEADERBOARD = {
    total: 4,
    your_rank: null,
    items: [0, 1, 2, 3].map(index => ({
        rank: index + 1,
        user_id: person(index).id,
        alias: person(index).alias,
        title: null,
        tag: null,
        balance: 9000 - index * 1000,
        staked: 500 + index * 100,
        net_worth: 12000 - index * 1500,
        profit: 2000 - index * 1500,
        bets_placed: 5 + index,
        positions_won: 4 - index,
        positions_lost: index,
        positions_refunded: index % 2,
        pending: index === 1,
        pending_count: index === 1 ? 2 : 0,
    })),
} satisfies PredictionLeaderboard

interface EventTable {
    name: string
    surfaceId: string
    reveal: (page: Page) => Promise<void>
}

const TABLES: EventTable[] = [
    {
        name: 'group standings',
        surfaceId: 'event-detail/bracket',
        reveal: async page => {
            await page.getByRole('button', { name: 'Group Stage', exact: true }).click()
            await expect(page.getByRole('heading', { name: 'Group A', exact: true })).toBeVisible()
        },
    },
    {
        name: 'predictions leaderboard',
        surfaceId: 'event-detail/predictions',
        reveal: async page => {
            await page.getByRole('button', { name: 'Leaderboard', exact: true }).click()
            await expect(page.getByText(person(0).alias, { exact: true }).first()).toBeVisible()
        },
    },
]

function surfaceNamed(id: string): CrawlSurface {
    const surface = crawlSurfaces('pr').find(candidate => candidate.id === id)
    if (!surface) throw new Error(`no crawl surface for ${id}`)
    return surface
}

async function open(page: Page, surface: CrawlSurface) {
    await page.addInitScript(storage => {
        for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value)
    }, { [CONSENT_KEY]: 'denied', ...surface.entry.storage })
    await serveFixtureSet(page, surface.entry.fixtures)
    await page.route(/https:\/\/api\.utbt\.net\/tournaments\/[^/]+\/predictions\/leaderboard/, route =>
        route.fulfill({ json: { success: true, data: LEADERBOARD } }))
    const { path, steps } = surfaceSteps(surface)
    await reopenOnDroppedModule(page, async () => {
        await page.goto(path)
        for (const step of steps) await step(page)
    })
    await settleLayout(page)
}

async function openStandings(page: Page) {
    await open(page, surfaceNamed(TABLES[0].surfaceId))
    await TABLES[0].reveal(page)
    await settleLayout(page)
}

async function openTeamPage(page: Page) {
    await open(page, surfaceNamed(eventTeam.view))
}

function cardsNamed(page: Page, name: string): Locator {
    return page.getByRole('main').getByRole('list', { name }).first().getByRole('listitem')
}

async function openPanel(card: Locator) {
    const chevron = card.getByRole('button', { name: 'Details' })
    await chevron.tap()
    await expect(chevron).toHaveAttribute('aria-expanded', 'true')
}

function panelValue(card: Locator, label: string): Locator {
    return card.getByRole('term').filter({ hasText: new RegExp(`^${label}$`) }).locator('xpath=following-sibling::dd[1]')
}

for (const viewport of crawlViewports('pr')) {
    test.describe(`${viewport.id} table rules`, () => {
        const size = { width: viewport.width, height: viewport.height }
        test.use({ viewport: size, contextOptions: { screen: size } })

        for (const table of TABLES) {
            test(`${table.name} passes the table and card rules`, { tag: viewport.engines.map(engine => `@${engine}-only`) }, async ({ page, browserName }) => {
                test.slow()
                const surface = surfaceNamed(table.surfaceId)
                await open(page, surface)
                await table.reveal(page)
                await settleLayout(page)
                await installProbe(page)
                for (const rule of TABLE_RULES) {
                    const result = await RULE_CHECKS[rule]({ page, surface, viewport, engine: browserName as Engine })
                    expect(result.status, `${rule}: ${result.detail.join('; ')}`).not.toBe('fail')
                }
            })
        }
    })
}

test.describe('event table cards', () => {
    test.use({ viewport: PHONE, contextOptions: { screen: PHONE } })

    test('a standings card keeps one expand control, and its panel shows maps, diff, caps and the team matches', async ({ page }) => {
        await openStandings(page)
        const card = cardsNamed(page, 'Group standings').first()
        await expect(card.getByRole('button')).toHaveCount(1)
        await expect(card.getByRole('term')).toHaveCount(0)

        await openPanel(card)
        await expect(card.getByRole('term')).toHaveText(['Maps', 'Diff', 'Caps'])
        await expect(panelValue(card, 'Maps')).toHaveText(/^\d+–\d+$/)
        await expect(card.getByText('Matches', { exact: true })).toBeVisible()
        await expect(card.getByText(/^Picked by /).first()).toBeVisible()
    })

    test('a standings row in the table still reveals the team matches', async ({ page }) => {
        await openStandings(page)
        await page.setViewportSize(DESKTOP)
        await settleLayout(page)
        const table = page.getByRole('main').getByRole('table').first()
        await expect(table).toBeVisible()
        const row = table.locator('tbody > tr').first()
        const rows = table.locator('tbody > tr')
        const teams = await rows.count()
        await expect(row).toHaveAttribute('aria-expanded', 'false')
        await expect(table.getByText(/^Picked by /)).toHaveCount(0)

        await row.click()
        await expect(row).toHaveAttribute('aria-expanded', 'true')
        await expect(rows).toHaveCount(teams + 1)
        await expect(rows.nth(1).getByText(/^Picked by /).first()).toBeVisible()
    })

    test('a standings card body opens the team\'s event page', async ({ page }) => {
        await openStandings(page)
        const card = cardsNamed(page, 'Group standings').first()
        await card.getByText(/^\d+–\d+(–\d+)?$/).tap()
        await expect(page).toHaveURL(/\/events\/[^/]+\/teams\/[^/]+$/)
    })

    test('team runs sort with the shared card control, and the table header shows the same sort', async ({ page }) => {
        await openTeamPage(page)
        const list = page.getByRole('main').getByRole('list', { name: 'All runs' })
        await expect(list).toBeVisible()
        const runs = page.getByRole('region', { name: 'All runs' })
        const field = runs.getByRole('combobox', { name: 'Sort by' })
        const direction = runs.getByRole('button', { name: /^(Ascending|Descending)$/ })
        await expect(field.locator('option')).toHaveText(['Map', 'Time', 'Opponent', 'Stage', 'Date'])
        await expect(field).toHaveValue('date')

        const times = () => list.getByRole('listitem').evaluateAll(cards =>
            cards.map(card => (card.textContent ?? '').match(/\d{2}:\d{2}\.\d{3}/)?.[0] ?? ''))
        await field.selectOption('time')
        await expect(direction).toHaveText('Ascending')
        await expect.poll(async () => {
            const shown = await times()
            return shown.length > 1 && shown.every((time, index) => index === 0 || shown[index - 1] <= time)
        }).toBe(true)

        await direction.tap()
        await expect(direction).toHaveText('Descending')
        await expect.poll(async () => {
            const shown = await times()
            return shown.length > 1 && shown.every((time, index) => index === 0 || shown[index - 1] >= time)
        }).toBe(true)

        await page.setViewportSize(DESKTOP)
        await settleLayout(page)
        await expect(runs.getByRole('columnheader', { name: 'Time' })).toHaveAttribute('aria-sort', 'descending')
        await expect(runs.getByRole('combobox', { name: 'Sort by' })).toHaveCount(0)
    })

    test('the team map profile and team runs cards keep their essentials on the face and the rest in the panel', async ({ page }) => {
        await openTeamPage(page)
        const profile = cardsNamed(page, 'Map profile').first()
        await expect(profile.getByText('W-D-L', { exact: true })).toBeVisible()
        await openPanel(profile)
        await expect(profile.getByRole('term')).toHaveText(['Picked', 'Banned', 'Banned vs', 'Played', 'Caps'])

        const run = cardsNamed(page, 'All runs').first()
        await expect(run.getByText(/^vs /)).toBeVisible()
        await openPanel(run)
        await expect(run.getByRole('term')).toHaveText(['Run', 'Stage', 'Date', 'Replay'])
        await expect(page).toHaveURL(new RegExp(`/teams/${EVENT_TEAM_ID}$`))
    })
})
