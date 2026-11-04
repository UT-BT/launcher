import { expect, test, type Locator, type Page } from '@playwright/test'
import { runCompareErrors, runCompareFixture } from '../app/utils/fixtures/runCompareFixtures'
import type { CapCompareCandidate, CapDetail, LeaderboardEntry } from '../app/utils/api'
import { defaultCompareCandidate } from '../app/components/pages/capDetail/runDelta/compareCandidates'
import { replayVideoUrl, serveReplayVideos } from './replayVideos'
import { ALPHA, BRAVO, mockTeamComparisons, mockTeamRuns, teamFixtureOf, TEAM_POVS, type TeamFixture } from './teamRuns'

const AVATAR = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const FIRST_LOAD = { timeout: 15_000 }
const TOUCH_GRID = { width: 1280, height: 800 }
const RUNNER = runCompareFixture('capDetailCandidates')
const RUNNER_ID = RUNNER.cap.id
const CANDIDATES = RUNNER.compare_candidates
const DEFAULT_OPPONENT = defaultCompareCandidate(RUNNER.cap.cap_time_seconds, RUNNER.cap.has_ghost, CANDIDATES)!
const ZONES_RUN = CANDIDATES.find(candidate => !candidate.has_ghost)!
const SLOWER_GHOST = CANDIDATES.find(candidate => candidate.has_ghost && candidate.cap_time_seconds > RUNNER.cap.cap_time_seconds)!
const SLOWEST = CANDIDATES.toSorted((a, b) => b.cap_time_seconds - a.cap_time_seconds)[0]
const CONFLICT = runCompareErrors().find(entry => entry.body.code === 'no_ghost')!
const SOLO_IDS = [RUNNER_ID, ...CANDIDATES.map(candidate => candidate.id)]

const TEAM_ALIGNED = runCompareFixture('teamAligned')
const ALIGNED_RUNNER = teamFixtureOf(TEAM_ALIGNED.runner)
const ALIGNED_REFERENCE: TeamFixture = {
    ...teamFixtureOf(TEAM_ALIGNED.reference),
    members: teamFixtureOf(TEAM_ALIGNED.reference).members.map(member => ({ ...member, seconds: member.seconds - 1 })),
}
const ALIGNED_POVS = [ALIGNED_RUNNER, ALIGNED_REFERENCE].flatMap(team => team.members.map(member => member.capId))

function candidateDetail(candidate: CapCompareCandidate): CapDetail {
    return {
        ...RUNNER,
        cap: {
            ...RUNNER.cap,
            id: candidate.id,
            user: candidate.user,
            alias: candidate.alias,
            cap_time_seconds: candidate.cap_time_seconds,
            has_ghost: candidate.has_ghost,
            team: 0,
            active_title: null,
        },
        checkpoints: RUNNER.wr_checkpoints,
        compare_candidates: [],
    }
}

const DETAILS = new Map<string, CapDetail>([
    [RUNNER_ID, RUNNER],
    ...CANDIDATES.map(candidate => [candidate.id, candidateDetail(candidate)] as const),
])

function leaderboardEntry({ cap }: CapDetail): LeaderboardEntry {
    return {
        map: cap.map,
        user: String(cap.user),
        cap_time_seconds: cap.cap_time_seconds,
        added: cap.added ?? '',
        alias: cap.alias ?? '',
        cap_type: cap.cap_type,
        verified: true,
        id: cap.id,
        team: cap.team,
        active_title: null,
        has_ghost: cap.has_ghost,
        zone_checkpoints: cap.zone_checkpoints ?? null,
        disallowed: false,
    }
}

async function mockApi(page: Page, videos: readonly string[] = SOLO_IDS) {
    await page.addInitScript(() => { localStorage.setItem('utbt:analyticsConsent:v1', 'denied') })
    await serveReplayVideos(page)
    const leaderboard = [...DETAILS.values()].map(leaderboardEntry).toSorted((a, b) => a.cap_time_seconds - b.cap_time_seconds)
    await page.route(/https:\/\/cdn\.discordapp\.com\/.*/, route => route.fulfill({ contentType: 'image/png', body: AVATAR }))
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, route => {
        const url = new URL(route.request().url())
        const path = url.pathname.replace(/\/$/, '')
        if (url.hostname === 'gateway.utbt.net') {
            if (/^\/users\/[^/]+\/avatar$/.test(path)) return route.fulfill({ contentType: 'image/png', body: AVATAR })
            const replay = /^\/replays\/([^/]+)$/.exec(path)
            if (replay && videos.includes(replay[1])) {
                return route.fulfill({ json: { source: 'utrecorder', mp4_url: replayVideoUrl(replay[1]), view_url: null, fps: 60 } })
            }
            return route.fulfill({ json: [] })
        }
        if (path === '/ghosts/compare') return route.fulfill({ status: CONFLICT.status, json: CONFLICT.body })
        const detail = /^\/caps\/([^/]+)\/detail$/.exec(path)
        if (detail) {
            const found = DETAILS.get(detail[1])
            if (!found) return route.fulfill({ status: 404, json: { success: false, error: 'Cap not found' } })
            return route.fulfill({ json: { success: true, data: found } })
        }
        if (path === `/caps/leaderboard/map/${RUNNER.cap.map}`) return route.fulfill({ json: { success: true, data: leaderboard } })
        return route.fulfill({ json: { success: true, data: [] } })
    })
}

async function mockTeams(page: Page, teams: readonly TeamFixture[], videos: readonly string[]) {
    await mockApi(page, videos)
    await mockTeamRuns(page, teams, { videos })
}

function historyLength(page: Page): Promise<number> {
    return page.evaluate(() => window.history.length)
}

function search(page: Page): string {
    return new URL(page.url()).search
}

async function historyAtPageEntry(page: Page) {
    await page.waitForFunction(() => !(window.history.state && typeof window.history.state === 'object' && 'overlay' in window.history.state))
}

function mainScrollTop(page: Page): Promise<number> {
    return page.getByRole('main').evaluate(main => main.scrollTop)
}

function lanes(page: Page): Locator {
    return page.getByRole('list', { name: 'Lanes' })
}

function lane(page: Page, alias: string): Locator {
    return lanes(page).getByRole('listitem').filter({ hasText: alias })
}

function tile(page: Page, alias: string): Locator {
    return page.getByRole('region', { name: 'Stage' }).getByRole('group', { name: alias })
}

function teamHeaders(page: Page): Locator {
    return page.getByRole('region', { name: 'Stage' }).locator('.run-compare-team-header')
}

function drawer(page: Page): Locator {
    return page.getByRole('region', { name: 'Runs' })
}

function runsButton(page: Page): Locator {
    return page.getByRole('region', { name: 'Playback' }).getByRole('button', { name: 'Runs', exact: true })
}

function rosterRow(page: Page, alias: string): Locator {
    return drawer(page).getByRole('list', { name: 'Roster' }).getByRole('listitem').filter({ hasText: alias })
}

function leaderboardRow(page: Page, alias: string): Locator {
    return drawer(page).getByRole('list', { name: 'Leaderboard' }).getByRole('listitem').filter({ hasText: alias })
}

function checkpointCard(page: Page): Locator {
    return page
        .getByText('Checkpoint Deltas', { exact: true })
        .locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]')
}

function heroCompare(page: Page): Locator {
    return page.getByRole('main').getByRole('link', { name: 'Compare', exact: true })
}

test.beforeEach(async ({ page, isMobile }) => {
    page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.message))
    if (isMobile) await page.setViewportSize(TOUCH_GRID)
})

test.describe('Cap Detail', () => {
    test('Compare opens the page straight away with this run and the default opponent, in a new entry', async ({ page }) => {
        await mockApi(page)
        await page.goto(`/caps/${RUNNER_ID}`)
        await expect(heroCompare(page)).toHaveAttribute('href', `/compare?runs=${RUNNER_ID},${DEFAULT_OPPONENT.id}`)
        const lengthBefore = await historyLength(page)

        await heroCompare(page).click()

        await expect(page).toHaveURL(`/compare?runs=${RUNNER_ID},${DEFAULT_OPPONENT.id}`)
        await expect(lanes(page).getByRole('listitem')).toHaveCount(2, FIRST_LOAD)
        await expect(lane(page, RUNNER.cap.alias!)).toBeVisible()
        await expect(lane(page, DEFAULT_OPPONENT.alias!)).toBeVisible()
        await expect(tile(page, DEFAULT_OPPONENT.alias!).locator('video')).toHaveCount(1)
        expect(await historyLength(page)).toBe(lengthBefore + 1)
    })

    test('editing the set in the drawer replaces the address, and one Back returns to Cap Detail as it was left', async ({ page }) => {
        await mockApi(page)
        await page.goto(`/caps/${RUNNER_ID}`)
        const card = checkpointCard(page)
        await card.getByLabel('compare vs').selectOption(SLOWER_GHOST.id)
        const watch = card.getByRole('link', { name: 'Watch Side by Side' })
        await watch.scrollIntoViewIfNeeded()
        const scrolled = await mainScrollTop(page)

        await watch.click()

        await expect(page).toHaveURL(`/compare?runs=${RUNNER_ID},${SLOWER_GHOST.id}`)
        await expect(lanes(page).getByRole('listitem')).toHaveCount(2, FIRST_LOAD)
        const lengthOnPage = await historyLength(page)
        await runsButton(page).click()
        await leaderboardRow(page, SLOWEST.alias!).getByRole('button', { name: 'Add', exact: true }).click()
        await expect.poll(() => search(page)).toBe(`?runs=${RUNNER_ID},${SLOWER_GHOST.id},${SLOWEST.id}`)
        await expect(lanes(page).getByRole('listitem')).toHaveCount(3)
        await rosterRow(page, SLOWER_GHOST.alias!).getByRole('button', { name: 'Remove' }).click()
        await expect.poll(() => search(page)).toBe(`?runs=${RUNNER_ID},${SLOWEST.id}`)
        await expect(lanes(page).getByRole('listitem')).toHaveCount(2)
        await drawer(page).getByRole('button', { name: 'Close Runs' }).click()
        await expect(drawer(page)).toHaveCount(0)
        await historyAtPageEntry(page)
        expect(search(page)).toBe(`?runs=${RUNNER_ID},${SLOWEST.id}`)
        expect(await historyLength(page)).toBe(lengthOnPage + 1)

        await page.goBack()

        await expect(page).toHaveURL(`/caps/${RUNNER_ID}`)
        await expect(checkpointCard(page).getByLabel('compare vs')).toHaveValue(SLOWER_GHOST.id)
        await expect.poll(() => mainScrollTop(page)).toBeCloseTo(scrolled, -1)
    })

    test("the checkpoint card's Watch Side by Side opens the pair the card shows", async ({ page }) => {
        await mockApi(page)
        await page.goto(`/caps/${RUNNER_ID}`)
        const card = checkpointCard(page)
        const watch = card.getByRole('link', { name: 'Watch Side by Side' })
        await expect(watch).toHaveAttribute('href', `/compare?runs=${RUNNER_ID},${DEFAULT_OPPONENT.id}`)

        await card.getByLabel('compare vs').selectOption(ZONES_RUN.id)
        await watch.click()

        await expect(page).toHaveURL(`/compare?runs=${RUNNER_ID},${ZONES_RUN.id}`)
        await expect(lane(page, ZONES_RUN.alias!)).toBeVisible(FIRST_LOAD)
        await expect(lane(page, RUNNER.cap.alias!)).toBeVisible()
    })

    test("the Watch modal's Compare opens the page with that run and the drawer open", async ({ page }) => {
        await mockApi(page)
        await page.goto(`/caps/${RUNNER_ID}`)
        await page.getByRole('button', { name: 'Watch Replay' }).click()
        const modal = page.locator('[data-modal-backdrop] > div').filter({ has: page.getByRole('heading', { name: /^Replay —/ }) })
        await expect(modal.locator('video')).toHaveAttribute('playsinline')

        await modal.getByRole('link', { name: 'Compare', exact: true }).click()

        await expect(page).toHaveURL(`/compare?runs=${RUNNER_ID}`)
        await expect(modal).toHaveCount(0)
        await expect(drawer(page)).toBeVisible(FIRST_LOAD)
        await expect(rosterRow(page, RUNNER.cap.alias!)).toBeVisible()
    })
})

test.describe('Team Cap Detail', () => {
    test('Watch Team Run opens this team run alone, one row with every POV', async ({ page }) => {
        await mockTeams(page, [ALPHA, BRAVO], TEAM_POVS)
        await page.goto(`/team-caps/${ALPHA.teamCapId}`)

        await page.getByRole('main').getByRole('link', { name: 'Watch Team Run' }).click()

        await expect(page).toHaveURL(`/compare?runs=${ALPHA.teamCapId}`)
        await expect(teamHeaders(page)).toHaveCount(1, FIRST_LOAD)
        await expect(teamHeaders(page)).toContainText('Alpha One & Alpha Two')
        await expect(tile(page, 'Alpha One').locator('video')).toHaveCount(1)
        await expect(tile(page, 'Alpha Two').locator('video')).toHaveCount(1)
        await expect(page.getByRole('main').getByText('Not enough replay videos')).toHaveCount(0)
    })

    test("a member's Watch modal Compare opens that member's team run", async ({ page }) => {
        await mockTeams(page, [ALPHA, BRAVO], TEAM_POVS)
        await page.goto(`/team-caps/${ALPHA.teamCapId}`)
        await page.getByRole('main').getByRole('button', { name: 'Watch', exact: true }).first().click()
        const modal = page.locator('[data-modal-backdrop] > div').filter({ has: page.getByRole('heading', { name: /^Replay —/ }) })
        const compare = modal.getByRole('link', { name: 'Compare', exact: true })
        await expect(compare).toHaveAttribute('href', `/compare?runs=${ALPHA.teamCapId}`)

        await compare.click()

        await expect(page).toHaveURL(`/compare?runs=${ALPHA.teamCapId}`)
        await expect(modal).toHaveCount(0)
        await expect(teamHeaders(page)).toHaveCount(1, FIRST_LOAD)
        await expect(teamHeaders(page)).toContainText('Alpha One & Alpha Two')
    })

    test('Compare on a 2v2 adds the next faster team run: a 2×2 grid by pair and the team splits table', async ({ page, isMobile }) => {
        await mockTeams(page, [ALIGNED_RUNNER, ALIGNED_REFERENCE], ALIGNED_POVS)
        await mockTeamComparisons(page, [TEAM_ALIGNED])
        await page.goto(`/team-caps/${ALIGNED_RUNNER.teamCapId}`)
        const compare = page.getByRole('main').getByRole('link', { name: 'Compare', exact: true })
        await expect(compare).toHaveAttribute('href', `/compare?runs=${ALIGNED_RUNNER.teamCapId},${ALIGNED_REFERENCE.teamCapId}`)

        await compare.click()

        await expect(page).toHaveURL(`/compare?runs=${ALIGNED_RUNNER.teamCapId},${ALIGNED_REFERENCE.teamCapId}`)
        await expect(teamHeaders(page)).toHaveCount(2, FIRST_LOAD)
        for (const alias of ['fierd_6', 'Nightwolf`', 'gxls', '[UTW]Nettlez']) await expect(tile(page, alias).locator('video')).toHaveCount(1)
        await expect(page.getByRole('region', { name: 'Team Splits' }).getByRole('button', { name: /^(Cue .+|Seek to the cap)$/ })).toHaveText(['Bridge', 'Ramp', 'Lift', 'Pit', 'Flag', 'Cap'])
        if (isMobile) return
        const [nightwolf, fierd, gxls, nettlez] = await Promise.all(['Nightwolf`', 'fierd_6', 'gxls', '[UTW]Nettlez'].map(async alias => (await tile(page, alias).boundingBox())!))
        expect(nightwolf.x).toBeCloseTo(gxls.x, 0)
        expect(fierd.x).toBeCloseTo(nettlez.x, 0)
        expect(nightwolf.y).toBeCloseTo(fierd.y, 0)
        expect(gxls.y).toBeGreaterThan(nightwolf.y + nightwolf.height - 1)
    })

    test('Compare on the world record falls back to the next slower team run', async ({ page }) => {
        await mockTeams(page, [ALIGNED_RUNNER, ALIGNED_REFERENCE], ALIGNED_POVS)
        await page.goto(`/team-caps/${ALIGNED_REFERENCE.teamCapId}`)

        await expect(page.getByRole('main').getByRole('link', { name: 'Compare', exact: true }))
            .toHaveAttribute('href', `/compare?runs=${ALIGNED_REFERENCE.teamCapId},${ALIGNED_RUNNER.teamCapId}`)
    })
})
