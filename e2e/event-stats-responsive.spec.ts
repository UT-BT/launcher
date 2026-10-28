import { expect, test, type Locator, type Page } from '@playwright/test'
import { eventStatsFixture } from '../app/utils/fixtures/eventStatsFixtures'
import { horizontalOverflow } from './layout'

const SLUG = 'stats-cup'
const VIEWPORTS = [
    { name: 'phone', width: 390, height: 844, compact: true },
    { name: 'desktop', width: 1366, height: 900, compact: false },
]

const EVENT = {
    id: 'event-1',
    slug: SLUG,
    name: 'Stats Cup 2026',
    summary: 'A cup for checking the stats pages.',
    description: null,
    rules: null,
    team_size: 2,
    status: 'active',
    signups_open: false,
    signup_opens_at: null,
    signup_closes_at: null,
    starts_at: null,
    ends_at: null,
    max_teams: null,
    registered_team_count: 6,
    created_at: null,
    published_at: null,
    predictions_enabled: false,
    achievements_enabled: false,
}

const publishedOverview = eventStatsFixture('overviewAll')
const unpublishedOverview = eventStatsFixture('overviewUnpublished')
const teamStats = eventStatsFixture('team')
const TEAM_PATH = `/events/${SLUG}/teams/${teamStats.team.id}`

function rosterTeam(id: string, name: string, index: number) {
    return {
        id,
        tournament_id: EVENT.id,
        name,
        captain: `captain-${index}`,
        status: 'registered',
        division: null,
        seed: null,
        member_count: 2,
        members: [],
        created_at: null,
    }
}

async function expectTable(region: Locator, name: string, compact: boolean) {
    await expect(region.getByRole('list', { name })).toHaveCount(compact ? 1 : 0)
    await expect(region.getByRole('table')).toHaveCount(compact ? 0 : 1)
    await expect(compact ? region.getByRole('list', { name }) : region.getByRole('table')).toBeVisible()
}

async function mockApi(page: Page, options: { bracketPublished: boolean }) {
    const overview = options.bracketPublished ? publishedOverview : unpublishedOverview
    const roster = publishedOverview.teams.map((entry, index) => rosterTeam(entry.id, entry.name, index))

    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())

        if (url.hostname === 'gateway.utbt.net') {
            await route.fulfill({ json: [] })
            return
        }

        const path = url.pathname.replace(/\/$/, '')
        const ok = (data: unknown) => route.fulfill({ json: { success: true, data } })

        if (path === `/tournaments/${SLUG}`) return ok({ tournament: EVENT })
        if (path === `/tournaments/${SLUG}/bracket`) {
            return ok({ stages: [], format: { spec: null, template: null }, published: options.bracketPublished })
        }
        if (path === `/tournaments/${SLUG}/stats`) return ok(overview)
        if (path === `/tournaments/${SLUG}/teams/${teamStats.team.id}/stats`) return ok(teamStats)
        if (path === `/tournaments/${SLUG}/me`) return ok({ team: null, invitations: [], lfp: null, volunteer: null })
        if (path === `/tournaments/${SLUG}/teams`) return ok({ items: roster })
        if (path === `/tournaments/${SLUG}/lfp`) return ok({ items: [] })

        return ok([])
    })
}

test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.message))
})

for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.name} (${viewport.width}px)`, () => {
        test.use({ viewport: { width: viewport.width, height: viewport.height } })

        test('overview with a published bracket shows the glance strip, team cards and map table', async ({ page }) => {
            await mockApi(page, { bracketPublished: true })
            await page.goto(`/events/${SLUG}?tab=teams`)

            await expect(page.getByRole('heading', { name: 'Cup at a glance' })).toBeVisible()
            const cards = page.getByRole('region', { name: 'Teams' }).getByRole('link')
            await expect(cards).toHaveCount(publishedOverview.teams.length)
            await expect(cards.filter({ hasText: "Hop n' Twerk" })).toBeVisible()

            const maps = page.getByRole('region', { name: 'Maps' })
            await expectTable(maps, 'Maps', viewport.compact)
            await expect(maps).toContainText('AztecCE')
            expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        })

        test('team page shows the tiles, timeline, map profile and runs table', async ({ page }) => {
            await mockApi(page, { bracketPublished: true })
            await page.goto(TEAM_PATH)

            await expect(page.getByRole('heading', { level: 1, name: teamStats.team.name })).toBeVisible()
            await expect(page.getByText('Caps for / against')).toBeVisible()
            await expect(page.getByText('Pace', { exact: true })).toBeVisible()

            await expect(page.getByRole('button', { name: 'Hide match details' })).toHaveCount(1)
            const expandedMatch = page.locator('[id^="team-match-"]')
            await expect(expandedMatch).toHaveCount(1)
            await expect(expandedMatch.getByRole('list', { name: 'Pick and ban steps' })).toBeVisible()
            await expect(expandedMatch.getByText('Hover a player for their own cap time')).toBeVisible()
            await expect(expandedMatch.getByText(/^\d{2}:\d{2}\.\d{3}$/).first()).toBeVisible()

            await expectTable(page.getByRole('region', { name: 'Map profile' }), 'Map profile', viewport.compact)
            const runs = page.getByRole('region', { name: 'All runs' })
            await expectTable(runs, 'All runs', viewport.compact)
            await expect(runs.getByText(`${teamStats.runs.length} linked runs`)).toBeVisible()
            expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        })
    })
}

test('the teams tab lists the roster while the bracket is unpublished', async ({ page }) => {
    await mockApi(page, { bracketPublished: false })
    await page.goto(`/events/${SLUG}?tab=teams`)

    await expect(page.getByText('6 registered')).toBeVisible()
    await expect(page.getByRole('heading', { name: "Hop n' Twerk" })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Cup at a glance' })).toHaveCount(0)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
})

test('a team card is a real link that opens the team page', async ({ page }) => {
    await mockApi(page, { bracketPublished: true })
    await page.goto(`/events/${SLUG}?tab=teams`)

    const card = page.getByRole('region', { name: 'Teams' }).locator(`a[href="${TEAM_PATH}"]`)
    await expect(card).toHaveCount(1)
    await expect(card).toBeVisible()
    await card.click()

    await expect(page).toHaveURL(new RegExp(`${TEAM_PATH}$`))
    await expect(page.getByRole('heading', { level: 1, name: teamStats.team.name })).toBeVisible()
})
