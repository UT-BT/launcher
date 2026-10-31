import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
    RUN_COMPARE_FIXTURES,
    runCompareErrors,
    runCompareFixture,
    type RunCompareComparisonName,
} from '../app/utils/fixtures/runCompareFixtures'
import type { CapCheckpoint, CapComparisonErrorCode, CapDetail } from '../app/utils/api'
import { defaultCompareCandidate } from '../app/components/pages/capDetail/runDelta/compareCandidates'
import { horizontalOverflow } from './layout'

const VIEWPORTS = [
    { name: 'phone', width: 390, height: 844, replayColumns: 3, zoneColumns: 3 },
    { name: 'desktop', width: 1366, height: 900, replayColumns: 4, zoneColumns: 5 },
]

const VIDEO = readFileSync(resolve(__dirname, 'next-map-flythrough.webm'))
const AVATAR = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const MEDIA_HOST = 'https://media.replays.test'
const VIDEO_TAIL_SECONDS = 1

const separated = runCompareFixture('separated')
const SEPARATED_SECTORS = separated.sectors.filter(sector => sector.separated).length
const RUNNER_DETAIL = runCompareFixture('capDetailCandidates')
const RUNNER_ID = RUNNER_DETAIL.cap.id
const MAP = RUNNER_DETAIL.cap.map
const CANDIDATES = RUNNER_DETAIL.compare_candidates
const DEFAULT_PICK = defaultCompareCandidate(RUNNER_DETAIL.cap.cap_time_seconds, RUNNER_DETAIL.cap.has_ghost, CANDIDATES)!
const ZONES_PICK = CANDIDATES.find(candidate => !candidate.has_ghost)!
const VIDEO_OPPONENT = CANDIDATES.find(candidate => candidate.id === separated.reference.cap_id)!

const REFERENCE_CHECKPOINTS: CapCheckpoint[] = [
    { zone: 'Courtyard', cumulative: 10.077, segment: 10.077 },
    { zone: 'Bridge', cumulative: 20.155, segment: 10.078 },
    { zone: 'Library', cumulative: 31.367, segment: 11.212 },
    { zone: 'Chimney', cumulative: 50.267, segment: 18.9 },
    { zone: 'Attic', cumulative: 65.796, segment: 15.529 },
    { zone: 'Cellar', cumulative: 83.88, segment: 18.084 },
    { zone: 'Flag Room', cumulative: 100.77, segment: 16.89 },
]

type CompareOutcome = RunCompareComparisonName | CapComparisonErrorCode

interface CapPageSetup {
    cardCompare?: CompareOutcome
    videoCompare?: CompareOutcome
}

function candidateDetail(candidateId: string): CapDetail {
    const candidate = CANDIDATES.find(entry => entry.id === candidateId)!
    return {
        ...RUNNER_DETAIL,
        cap: {
            ...RUNNER_DETAIL.cap,
            id: candidate.id,
            user: candidate.user,
            alias: candidate.alias,
            cap_time_seconds: candidate.cap_time_seconds,
            has_ghost: candidate.has_ghost,
            team: 0,
            active_title: null,
        },
        checkpoints: candidateId === VIDEO_OPPONENT.id ? REFERENCE_CHECKPOINTS : RUNNER_DETAIL.wr_checkpoints,
        compare_candidates: [],
    }
}

function leaderboardEntry(id: string, user: string, alias: string | null, seconds: number) {
    return { map: MAP, user, cap_time_seconds: seconds, added: '2026-09-01T12:00:00', alias, cap_type: 0, verified: true, id, team: 0, active_title: null }
}

function capTimeOf(capId: string): number {
    return capId === RUNNER_ID
        ? RUNNER_DETAIL.cap.cap_time_seconds
        : (CANDIDATES.find(candidate => candidate.id === capId)?.cap_time_seconds ?? 60)
}

async function serveVideos(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        const native = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'duration')
        Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
            configurable: true,
            get(this: HTMLMediaElement) {
                const real = native?.get?.call(this) as number
                const length = Number(new URL(this.currentSrc || this.src, location.href).searchParams.get('length'))
                return Number.isFinite(real) && length > 0 ? length : real
            },
        })
    })
    await page.route(`${MEDIA_HOST}/**`, route => {
        const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers()['range'] ?? '')
        const headers = { 'access-control-allow-origin': '*', 'accept-ranges': 'bytes', 'content-type': 'video/webm' }
        if (!range) return route.fulfill({ status: 200, headers, body: VIDEO })
        const start = Number(range[1])
        const end = range[2] ? Math.min(Number(range[2]), VIDEO.length - 1) : VIDEO.length - 1
        return route.fulfill({
            status: 206,
            headers: { ...headers, 'content-range': `bytes ${start}-${end}/${VIDEO.length}` },
            body: VIDEO.subarray(start, end + 1),
        })
    })
}

async function mockCapPage(page: Page, setup: CapPageSetup) {
    const outcomeByReference = new Map<string, CompareOutcome | undefined>([
        [DEFAULT_PICK.id, setup.cardCompare],
        [VIDEO_OPPONENT.id, setup.videoCompare],
    ])
    const leaderboard = [
        leaderboardEntry(RUNNER_ID, RUNNER_DETAIL.cap.user, RUNNER_DETAIL.cap.alias, RUNNER_DETAIL.cap.cap_time_seconds),
        ...CANDIDATES.map(candidate => leaderboardEntry(candidate.id, candidate.user, candidate.alias, candidate.cap_time_seconds)),
    ]

    await serveVideos(page)
    await page.route(/https:\/\/cdn\.discordapp\.com\/.*/, route => route.fulfill({ contentType: 'image/png', body: AVATAR }))
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())
        const path = url.pathname.replace(/\/$/, '')

        if (url.hostname === 'gateway.utbt.net') {
            const replay = /^\/replays\/([^/]+)$/.exec(path)
            if (replay) {
                const length = capTimeOf(replay[1]) + VIDEO_TAIL_SECONDS
                return route.fulfill({
                    json: { source: 'utrecorder', mp4_url: `${MEDIA_HOST}/${replay[1]}.webm?length=${length}`, view_url: null, fps: 60 },
                })
            }
            if (/^\/users\/[^/]+\/avatar$/.test(path)) return route.fulfill({ contentType: 'image/png', body: AVATAR })
            return route.fulfill({ json: [] })
        }

        const ok = (data: unknown) => route.fulfill({ json: { success: true, data } })

        if (path === '/ghosts/compare/motion') return route.fulfill({ json: RUN_COMPARE_FIXTURES.motion.body })

        if (path === '/ghosts/compare') {
            const reference = url.searchParams.get('reference') ?? ''
            const outcome = outcomeByReference.get(reference)
            if (outcome && outcome in RUN_COMPARE_FIXTURES) {
                return route.fulfill({ json: RUN_COMPARE_FIXTURES[outcome as RunCompareComparisonName].body })
            }
            const error = runCompareErrors().find(entry => entry.body.code === (outcome ?? 'different_side'))!
            return route.fulfill({ status: error.status, json: error.body })
        }
        const detail = /^\/caps\/([^/]+)\/detail$/.exec(path)
        if (detail) {
            if (detail[1] === RUNNER_ID) return ok(RUNNER_DETAIL)
            if (CANDIDATES.some(candidate => candidate.id === detail[1])) return ok(candidateDetail(detail[1]))
        }
        if (path === `/caps/leaderboard/map/${MAP}`) return ok(leaderboard)

        return ok([])
    })
}

function checkpointCard(page: Page): Locator {
    return page
        .getByText('Checkpoint Deltas', { exact: true })
        .locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]')
}

function picker(card: Locator): Locator {
    return card.getByLabel('compare vs')
}

async function openCapPage(page: Page, setup: CapPageSetup): Promise<Locator> {
    await mockCapPage(page, setup)
    await page.goto(`/caps/${RUNNER_ID}`)
    const card = checkpointCard(page)
    await expect(card).toBeVisible()
    await card.scrollIntoViewIfNeeded()
    return card
}

function forkFlags(card: Locator): Locator {
    return card.getByRole('img', { name: 'different line in this sector' })
}

async function expectZonetimeView(card: Locator, columns: number) {
    await expect(card.getByText('Zones', { exact: true })).toBeVisible()
    await expect(card.getByText('Replay', { exact: true })).toHaveCount(0)
    await expect(card.getByRole('columnheader', { name: 'CP' })).toBeVisible()
    await expect(card.getByRole('columnheader', { name: 'Δ Total' })).toBeVisible()
    await expect(card.getByRole('columnheader', { name: 'Sector' })).toHaveCount(0)
    await expect(card.getByRole('columnheader')).toHaveCount(columns)
}

async function expectNoPageScroll(page: Page) {
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
}

function compareModal(page: Page): Locator {
    return page.locator('[data-modal-backdrop] > div').filter({ hasText: 'Replay Comparison' })
}

async function openVideoCompare(page: Page): Promise<Locator> {
    await page.getByRole('button', { name: 'Compare Run' }).click()
    const pick = page.getByRole('button', { name: new RegExp(VIDEO_OPPONENT.alias!.replace(/[[\]]/g, '\\$&')) })
    await expect(pick).toHaveAttribute('aria-disabled', 'false')
    await pick.click()
    const modal = compareModal(page)
    await expect(modal.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
    return modal
}

test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.message))
})

for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.name} (${viewport.width}px)`, () => {
        test.use({ viewport: { width: viewport.width, height: viewport.height } })

        test('a replay comparison shows the sector table, chart and tagged picker', async ({ page }) => {
            const card = await openCapPage(page, { cardCompare: 'aligned' })

            await expect(card.getByText('Replay', { exact: true })).toBeVisible()
            await expect(card.getByText('Zones', { exact: true })).toHaveCount(0)
            await expect(card.getByRole('columnheader')).toHaveCount(viewport.replayColumns)
            await expect(card.getByRole('columnheader', { name: 'Sector' })).toBeVisible()
            await expect(card.getByRole('row')).toHaveCount(11)
            await expect(card.locator('svg.font-mono')).toBeVisible()
            await expect(card.getByText('different line', { exact: true })).toBeVisible()
            await expect(forkFlags(card)).toHaveCount(0)
            await expect(card.getByText(/left .+'s line in this sector$/)).toHaveCount(0)

            const options = picker(card).locator('option')
            await expect(options).toHaveCount(CANDIDATES.length)
            await expect(options.filter({ hasText: '· Replay' })).toHaveCount(CANDIDATES.filter(c => c.has_ghost).length)
            await expect(options.filter({ hasText: '· Zones' })).toHaveCount(CANDIDATES.filter(c => !c.has_ghost).length)
            await expectNoPageScroll(page)
        })

        test('switching to a zones run shows the zone checkpoint view', async ({ page }) => {
            const card = await openCapPage(page, { cardCompare: 'aligned' })
            await expect(card.getByText('Replay', { exact: true })).toBeVisible()

            await picker(card).selectOption(ZONES_PICK.id)

            await expectZonetimeView(card, viewport.zoneColumns)
            await expectNoPageScroll(page)
        })

        test('a separated comparison flags the sectors with the fork icon and one legend line', async ({ page }) => {
            const card = await openCapPage(page, { cardCompare: 'separated' })
            const runner = separated.runner.alias!

            await expect(forkFlags(card).first()).toBeVisible()
            await expect(forkFlags(card)).toHaveCount(SEPARATED_SECTORS)
            await expect(card.getByText(`${runner} left ${DEFAULT_PICK.alias}'s line in this sector`)).toHaveCount(1)
            await expect(card.getByText('different line', { exact: true })).toBeVisible()
            await expectNoPageScroll(page)

            await card.getByRole('button', { name: 'Per sector' }).click()
            await expect(card.getByRole('button', { name: 'Per sector' })).toHaveAttribute('aria-pressed', 'true')
            await expect(card.getByText('gained', { exact: true })).toBeVisible()
            await expectNoPageScroll(page)
        })

        test('the speed view swaps in both runs\' speed and splits each sector into speed and line', async ({ page }) => {
            const card = await openCapPage(page, { cardCompare: 'separated' })

            await card.getByRole('button', { name: 'Speed', exact: true }).click()
            await expect(card.getByRole('button', { name: 'Speed', exact: true })).toHaveAttribute('aria-pressed', 'true')
            await expect(card.getByRole('columnheader')).toHaveCount(viewport.replayColumns)
            await expect(card.getByRole('columnheader', { name: 'Δ Speed' })).toBeVisible()
            await expect(card.getByRole('columnheader', { name: 'Δ Line' })).toBeVisible()
            await expect(card.getByRole('columnheader', { name: 'Δ Split' })).toHaveCount(0)
            await expect(card.getByRole('row')).toHaveCount(11)
            await expect(forkFlags(card)).toHaveCount(SEPARATED_SECTORS)
            await expect(card.getByRole('img', { name: /^Horizontal speed over the run/ })).toBeVisible()
            await expect(card.getByText(/^this run · \d+ avg$/)).toBeVisible()
            await expect(card.getByText('Whole run', { exact: true })).toBeVisible()
            await expectNoPageScroll(page)
        })

        test("a sector zooms the speed chart into every sample with each run's dodges and air time", async ({ page }) => {
            const card = await openCapPage(page, { cardCompare: 'separated' })
            await card.getByRole('button', { name: 'Speed', exact: true }).click()
            await expect(card.getByText(/click a sector or drag across the chart to zoom/)).toBeVisible()

            await card.getByRole('button', { name: 'Zoom the speed chart to S4' }).click()

            await expect(card.getByRole('button', { name: 'Zoom the speed chart to S4' })).toHaveAttribute('aria-pressed', 'true')
            await expect(card.getByRole('button', { name: 'Reset zoom', exact: true })).toBeVisible()
            await expect(card.getByText(/^Speed · S4 · vs /)).toBeVisible()
            await expect(card.getByText('dodge, pointing its way', { exact: true })).toBeVisible()
            await expect(card.locator('g[data-run="runner"] path').first()).toBeAttached()
            await expect(card.locator('g[data-run="reference"] path').first()).toBeAttached()
            await expectNoPageScroll(page)

            await card.getByRole('button', { name: 'Reset zoom', exact: true }).click()
            await expect(card.getByRole('button', { name: 'Reset zoom', exact: true })).toHaveCount(0)
            await expect(card.getByRole('button', { name: 'Zoom the speed chart to S4' })).toHaveAttribute('aria-pressed', 'false')

            await card.getByRole('button', { name: 'Zoom the speed chart to S2' }).click()
            await expect(card.getByRole('button', { name: 'Reset zoom', exact: true })).toBeVisible()
            await card.getByRole('button', { name: 'Zoom the speed chart to S2' }).click()
            await expect(card.getByRole('button', { name: 'Reset zoom', exact: true })).toHaveCount(0)

            await card.getByRole('button', { name: 'Zoom the speed chart to S5' }).click()
            await page.keyboard.press('Escape')
            await expect(card.getByRole('button', { name: 'Reset zoom', exact: true })).toHaveCount(0)

            if (viewport.width >= 1024) {
                await card.getByRole('button', { name: 'Zoom the speed chart to S5' }).click()
                await card.getByRole('img', { name: /^Horizontal speed over the run/ }).locator('rect.cursor-crosshair').dblclick()
                await expect(card.getByRole('button', { name: 'Reset zoom', exact: true })).toHaveCount(0)
            }
        })

        test('routes that differ show the coverage and the final gap without a table', async ({ page }) => {
            const card = await openCapPage(page, { cardCompare: 'routesDiffer' })

            await expect(card.getByText('Routes differ for most of the run')).toBeVisible()
            await expect(card.getByText(/^Only \d+% of this run follows/)).toBeVisible()
            await expect(card.getByText('At the cap')).toBeVisible()
            await expect(card.getByText(/^[+−±]\d+\.\d{3}$/)).toBeVisible()
            await expect(card.getByRole('table')).toHaveCount(0)
            await expect(card.getByRole('button', { name: 'Per sector' })).toHaveCount(0)
            await expectNoPageScroll(page)
        })

        test('a failed comparison falls back to the zonetime view', async ({ page }) => {
            const card = await openCapPage(page, { cardCompare: 'no_ghost' })

            await expect(card.getByText('The replay comparison is unavailable, so this uses zone checkpoints.')).toBeVisible()
            await expectZonetimeView(card, viewport.zoneColumns)
            await expectNoPageScroll(page)
        })

        test('video compare opens with the delta strip', async ({ page }) => {
            await openCapPage(page, { cardCompare: 'aligned', videoCompare: 'separated' })
            const modal = await openVideoCompare(page)

            await expect(modal.getByRole('slider', { name: `Scrub both replays via ${separated.runner.alias}'s delta` })).toBeVisible()
            await expect(modal.getByText(`ticks = ${separated.runner.alias}'s sector splits`)).toBeVisible()
            await expectNoPageScroll(page)
            expect(await modal.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
        })
    })
}
