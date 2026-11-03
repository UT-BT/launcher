import { expect, test, type Locator, type Page } from '@playwright/test'
import { reopenOnDroppedModule } from './dev-server'
import { dataFrom } from './fixtures/data'
import { fixtureSetNamed } from './fixtures/index'
import { serveFixtureSet } from './fixtures/router'
import { signedInStorage } from './fixtures/synthetic/session'
import { swipeScroll } from './interactions'
import { playerDetail } from './manifest/player-detail'
import { teamCapDetail } from './manifest/team-cap-detail'
import { TEAM_ID, teamDetail } from './manifest/team-detail'
import type { MobileRouteEntry } from './manifest/types'
import { installProbe } from './rules/probe'
import { settleLayout } from './settle'

const MY_ID = '100000000000000001'
const OTHER_TEAM_ID = '00000000-0000-4000-8000-000000000001'
const POINTS_TIP = 'How points are calculated'

async function openEntry(page: Page, entry: MobileRouteEntry, setup?: () => Promise<void>) {
    await page.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    await serveFixtureSet(page, entry.fixtures)
    if (setup) await setup()
    await reopenOnDroppedModule(page, async () => {
        await page.goto(entry.path)
        await entry.ready(page)
    })
    await settleLayout(page)
    await installProbe(page)
}

function floatingTooltip(page: Page, text: string): Locator {
    return page.locator('body > div.fixed.pointer-events-none').filter({ hasText: text })
}

async function tapOn(page: Page, target: Locator) {
    await target.scrollIntoViewIfNeeded()
    const box = await target.boundingBox()
    if (!box) throw new Error('the target is not rendered')
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
}

function rankPill(page: Page): Locator {
    return page.locator('main span').filter({ hasText: /^Rank#/ }).first()
}

type TeamRecord = Record<string, unknown> & { members: unknown[] }

interface Teams {
    viewed: TeamRecord
    mine: TeamRecord
}

function withMe(team: TeamRecord, role: string, status: string): TeamRecord {
    const me = { user: MY_ID, alias: 'Tester', raw_alias: 'Tester', role, status, tag_hidden: false, title: {} }
    return { ...team, members: [...team.members, me] }
}

function otherTeam(team: TeamRecord): TeamRecord {
    return { ...team, id: OTHER_TEAM_ID, name: 'My Own Team', members: [] }
}

async function signInWithATeam(page: Page, teams: (recorded: TeamRecord) => Teams) {
    await page.addInitScript(storage => {
        for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value)
    }, signedInStorage())
    await page.route(/^https:\/\/api\.utbt\.net\/users\/me\/?(\?.*)?$/, route => route.fulfill({
        json: { success: true, data: { id: MY_ID, alias: 'Tester', utbt_role: 0 } },
    }))
    const set = fixtureSetNamed(teamDetail.fixtures)
    if (!set) throw new Error('no team-detail fixture set')
    const { viewed, mine } = teams(dataFrom(set).api(`/teams/${TEAM_ID}`) as TeamRecord)
    await page.route(new RegExp(`^https://api\\.utbt\\.net/teams/${TEAM_ID}/?(\\?.*)?$`), route => route.fulfill({
        json: { success: true, data: viewed },
    }))
    await page.route(/^https:\/\/api\.utbt\.net\/me\/team\/?(\?.*)?$/, route => route.fulfill({
        json: { success: true, data: { team: mine } },
    }))
}

test.describe('tooltips on a touch phone', () => {
    test('a tap opens a tooltip, and a tap elsewhere or a scroll closes it', async ({ page }) => {
        await openEntry(page, playerDetail)
        const pill = rankPill(page)
        const tooltip = floatingTooltip(page, POINTS_TIP)
        await expect(pill).toBeVisible()
        await expect(tooltip).toHaveCount(0)

        await tapOn(page, pill)
        await expect(tooltip).toBeVisible()

        await tapOn(page, page.getByRole('heading', { level: 1 }).first())
        await expect(tooltip).toHaveCount(0)

        await tapOn(page, pill)
        await expect(tooltip).toBeVisible()
        await tapOn(page, pill)
        await expect(tooltip).toHaveCount(0)

        await tapOn(page, pill)
        await expect(tooltip).toBeVisible()
        expect(await swipeScroll(page, 200), 'the page scrolls').not.toHaveLength(0)
        await expect(tooltip).toHaveCount(0)
    })

    test('a tap on a disabled button opens the tooltip that says why, and stays on the page', async ({ page }) => {
        await openEntry(page, playerDetail)
        const card = page.getByRole('list', { name: 'Caps' }).getByRole('listitem').first()
        await tapOn(page, card.getByRole('button', { name: 'Details' }))
        const watch = card.locator('button:disabled').first()
        await expect(watch).toBeVisible()
        const path = new URL(page.url()).pathname

        await tapOn(page, watch)
        await expect(floatingTooltip(page, 'No replay — cap not verified')).toBeVisible()
        expect(new URL(page.url()).pathname).toBe(path)
    })

    test('a disabled join shows why inline, without a tooltip', async ({ page }) => {
        await openEntry(page, teamDetail, () => signInWithATeam(page, team => ({
            viewed: { ...team, is_open: true },
            mine: otherTeam(team),
        })))
        await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeDisabled()
        await expect(page.getByText('Leave your current team to join', { exact: true })).toBeVisible()
        await expect(floatingTooltip(page, 'Leave your current team')).toHaveCount(0)
    })

    test('a disabled accept on an invitation shows why inline, without a tooltip', async ({ page }) => {
        await openEntry(page, teamDetail, () => signInWithATeam(page, team => ({
            viewed: withMe(team, 'member', 'invited'),
            mine: otherTeam(team),
        })))
        await expect(page.getByRole('button', { name: 'Accept', exact: true })).toBeDisabled()
        await expect(page.getByText('Leave your current team to accept', { exact: true })).toBeVisible()
        await expect(floatingTooltip(page, 'Leave your current team')).toHaveCount(0)
    })

    test('the manage members buttons read their action as text', async ({ page }) => {
        await openEntry(page, teamDetail, () => signInWithATeam(page, team => {
            const owned = withMe(team, 'owner', 'active')
            return { viewed: owned, mine: owned }
        }))
        await tapOn(page, page.getByRole('button', { name: 'Manage members', exact: true }))
        await expect(page.getByRole('heading', { name: 'Manage Members' })).toBeVisible()
        for (const label of ['Demote to member', 'Kick from team', 'Kick & block from rejoining']) {
            await expect(page.getByRole('button', { name: label, exact: true }).first()).toBeVisible()
        }
        const widest = await page.getByRole('button', { name: 'Kick & block from rejoining', exact: true }).first().boundingBox()
        expect(widest && widest.x + widest.width, 'the labelled buttons fit the screen').toBeLessThanOrEqual(page.viewportSize()?.width ?? 0)
        await expect(floatingTooltip(page, 'Kick from team')).toHaveCount(0)
    })

    test('each roster member\'s run status reads inline', async ({ page }) => {
        await openEntry(page, teamCapDetail)
        const roster = page.locator('[aria-pressed]')
        const count = await roster.count()
        expect(count).toBeGreaterThan(0)
        for (let i = 0; i < count; i++) {
            await expect(roster.nth(i).getByText(/^(Verified|Pending demo|Disallowed)$/)).toBeVisible()
        }
        await expect(floatingTooltip(page, 'Verified')).toHaveCount(0)
    })
})
