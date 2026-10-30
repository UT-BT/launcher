import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
    RUN_COMPARE_FIXTURES,
    runCompareErrors,
    runCompareFixture,
    type RunCompareComparisonName,
} from '../app/utils/fixtures/runCompareFixtures'
import type { CapCheckpoint, CapComparisonErrorCode, CapDetail, TeamCapDetail } from '../app/utils/api'
import { defaultCompareCandidate } from '../app/components/pages/capDetail/runDelta/compareCandidates'

const VIDEO = readFileSync(resolve(__dirname, 'next-map-flythrough.webm'))
const AVATAR = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const MEDIA_HOST = 'https://media.replays.test'
const VIDEO_TAIL_SECONDS = 1

const separated = runCompareFixture('separated')
const RUNNER = separated.runner
const REFERENCE = separated.reference
const RUNNER_DETAIL = runCompareFixture('capDetailCandidates')
const MAP = RUNNER_DETAIL.cap.map
const TEAM = runCompareFixture('teamCapDetailMembers')
const OTHER_SIDE_MEMBER = TEAM.members[2]

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

interface VideoCompareSetup {
    referenceSide?: number
    compare?: CompareOutcome
}

const SCREENSHOT_VIEWPORT = { width: 1440, height: 1000 }

function pairKey(runner: string, reference: string): string {
    return `${runner}|${reference}`
}

function referenceDetail(side: number): CapDetail {
    return {
        ...RUNNER_DETAIL,
        cap: {
            ...RUNNER_DETAIL.cap,
            id: REFERENCE.cap_id,
            user: REFERENCE.user,
            alias: REFERENCE.alias,
            cap_time_seconds: REFERENCE.cap_time_ms / 1000,
            team: side,
            active_title: null,
        },
        checkpoints: REFERENCE_CHECKPOINTS,
        compare_candidates: [],
    }
}

function otherSideDetail(): CapDetail {
    return {
        ...RUNNER_DETAIL,
        cap: { ...RUNNER_DETAIL.cap, ...OTHER_SIDE_MEMBER.cap, id: OTHER_SIDE_MEMBER.cap_id, team: 1 },
        compare_candidates: [],
    }
}

function teamDetail(): TeamCapDetail {
    const [first, second, third] = TEAM.members
    return {
        ...TEAM,
        team_time_seconds: REFERENCE.cap_time_ms / 1000,
        members: [
            {
                ...first,
                cap_id: RUNNER.cap_id,
                cap_time_seconds: RUNNER.cap_time_ms / 1000,
                cap: first.cap && { ...first.cap, id: RUNNER.cap_id, cap_time_seconds: RUNNER.cap_time_ms / 1000, team: 0 },
            },
            {
                ...second,
                cap_id: REFERENCE.cap_id,
                cap_time_seconds: REFERENCE.cap_time_ms / 1000,
                cap: second.cap && { ...second.cap, id: REFERENCE.cap_id, cap_time_seconds: REFERENCE.cap_time_ms / 1000, team: 0 },
            },
            { ...third, cap: third.cap && { ...third.cap, team: 1 } },
        ],
    }
}

function leaderboardEntry(id: string, user: string, alias: string | null, seconds: number, team: number) {
    return { map: MAP, user, cap_time_seconds: seconds, added: '2026-09-01T12:00:00', alias, cap_type: 0, verified: true, id, team, active_title: null }
}

function capTimeOf(capId: string): number {
    if (capId === RUNNER.cap_id) return RUNNER.cap_time_ms / 1000
    if (capId === REFERENCE.cap_id) return REFERENCE.cap_time_ms / 1000
    return OTHER_SIDE_MEMBER.cap_time_seconds ?? 60
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

async function mockApi(page: Page, setup: VideoCompareSetup): Promise<string[]> {
    const compareRequests: string[] = []
    const referenceSide = setup.referenceSide ?? 0
    const details = new Map<string, CapDetail>([
        [RUNNER.cap_id, RUNNER_DETAIL],
        [REFERENCE.cap_id, referenceDetail(referenceSide)],
        [OTHER_SIDE_MEMBER.cap_id, otherSideDetail()],
    ])
    const leaderboard = [
        leaderboardEntry(RUNNER.cap_id, RUNNER.user, RUNNER.alias, RUNNER.cap_time_ms / 1000, 0),
        leaderboardEntry(REFERENCE.cap_id, REFERENCE.user, REFERENCE.alias, REFERENCE.cap_time_ms / 1000, referenceSide),
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

        if (path === '/ghosts/compare') {
            const key = pairKey(url.searchParams.get('runner') ?? '', url.searchParams.get('reference') ?? '')
            compareRequests.push(key)
            const outcome = key === pairKey(RUNNER.cap_id, REFERENCE.cap_id) ? setup.compare : undefined
            if (outcome && outcome in RUN_COMPARE_FIXTURES) {
                return route.fulfill({ json: RUN_COMPARE_FIXTURES[outcome as RunCompareComparisonName].body })
            }
            const error = runCompareErrors().find(e => e.body.code === (outcome ?? 'different_side'))!
            return route.fulfill({ status: error.status, json: error.body })
        }
        const detail = /^\/caps\/([^/]+)\/detail$/.exec(path)
        if (detail && details.has(detail[1])) return ok(details.get(detail[1]))
        if (path === `/caps/team_caps/${TEAM.id}/detail`) return ok(teamDetail())
        if (path === `/caps/leaderboard/map/${MAP}`) return ok(leaderboard)

        return ok([])
    })
    return compareRequests
}

function compareModal(page: Page): Locator {
    return page.locator('[data-modal-backdrop] > div').filter({ hasText: 'Replay Comparison' })
}

function pane(modal: Locator, alias: string): Locator {
    return modal.locator('.grid > div').filter({ hasText: alias })
}

async function openFromCapPage(page: Page): Promise<Locator> {
    await page.goto(`/caps/${RUNNER.cap_id}`)
    await page.getByRole('button', { name: 'Compare Run' }).click()
    const pick = page.getByRole('button', { name: new RegExp(REFERENCE.alias!.replace(/[[\]]/g, '\\$&')) })
    await expect(pick).toHaveAttribute('aria-disabled', 'false')
    await pick.click()
    const modal = compareModal(page)
    await expect(modal.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
    return modal
}

async function openFromTeamPage(page: Page): Promise<Locator> {
    await page.goto(`/team-caps/${TEAM.id}`)
    await page.getByRole('button', { name: 'Watch Team Replay' }).click()
    const modal = compareModal(page)
    await expect(modal.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
    return modal
}

async function scrubTo(modal: Locator, seconds: number, span: number) {
    const track = modal.getByRole('slider', { name: 'Scrub all replays' })
    await track.scrollIntoViewIfNeeded()
    const box = await track.boundingBox()
    if (!box) throw new Error('scrubber not laid out')
    await modal.page().mouse.click(box.x + (box.width * seconds) / span, box.y + box.height / 2)
}

function scrubTicks(modal: Locator): Locator {
    return modal.getByRole('slider', { name: 'Scrub all replays' }).locator('div[style*="height"]')
}

const SPAN = REFERENCE.cap_time_ms / 1000 + VIDEO_TAIL_SECONDS
const CARD_PAIR = pairKey(
    RUNNER.cap_id,
    defaultCompareCandidate(RUNNER_DETAIL.cap.cap_time_seconds, RUNNER_DETAIL.cap.has_ghost, RUNNER_DETAIL.compare_candidates)!.id,
)
const RUNNER_STRIP = `Scrub both replays via ${RUNNER.alias}'s delta`
const CHECKPOINT_STRIP = 'Scrub both replays via the delta'

test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.message))
})

test.describe('cap page Compare Run', () => {
    test('a same-side pair follows the replay comparison', async ({ page }) => {
        const requests = await mockApi(page, { compare: 'separated' })
        const modal = await openFromCapPage(page)

        expect(new Set(requests)).toEqual(new Set([CARD_PAIR, pairKey(RUNNER.cap_id, REFERENCE.cap_id)]))
        await expect(modal.getByRole('slider', { name: RUNNER_STRIP })).toBeVisible()
        await expect(modal.getByText(`ticks = ${RUNNER.alias}'s sector splits`)).toBeVisible()
        await expect(scrubTicks(modal)).toHaveCount(20)

        await scrubTo(modal, 36.5, SPAN)
        await expect(pane(modal, RUNNER.alias!)).toContainText('Different line')
        await expect(pane(modal, RUNNER.alias!)).toContainText('(−14.806)')
        await expect(pane(modal, REFERENCE.alias!)).toContainText('S4')
        await expect(pane(modal, REFERENCE.alias!)).toContainText('(±0.000)')
    })

    test('a failed comparison keeps the checkpoint view', async ({ page }) => {
        const requests = await mockApi(page, { compare: 'no_ghost' })
        const modal = await openFromCapPage(page)

        expect(new Set(requests)).toEqual(new Set([CARD_PAIR, pairKey(RUNNER.cap_id, REFERENCE.cap_id)]))
        await expect(modal.getByRole('slider', { name: CHECKPOINT_STRIP })).toBeVisible()
        await expect(modal.getByRole('slider', { name: RUNNER_STRIP })).toHaveCount(0)

        await scrubTo(modal, 16.5, SPAN)
        await expect(pane(modal, RUNNER.alias!)).toContainText('CP2')
        await expect(pane(modal, RUNNER.alias!)).toContainText('(−4.177)')
        await expect(pane(modal, REFERENCE.alias!)).toContainText('CP1')
    })

    test('a run on the other side gets no ticks and no delta', async ({ page }) => {
        const requests = await mockApi(page, { referenceSide: 1, compare: 'separated' })
        const modal = await openFromCapPage(page)

        await expect(scrubTicks(modal)).toHaveCount(9)
        expect(new Set(requests)).toEqual(new Set([CARD_PAIR]))
        await expect(modal.getByRole('slider', { name: RUNNER_STRIP })).toHaveCount(0)
        await expect(modal.getByRole('slider', { name: CHECKPOINT_STRIP })).toHaveCount(0)
        await expect(pane(modal, RUNNER.alias!)).not.toContainText('−27.894')

        await scrubTo(modal, 30, SPAN)
        await expect(pane(modal, RUNNER.alias!)).toContainText('Other side')
    })
})

test.describe('team cap Watch Team Replay', () => {
    test('a mixed-side team compares only the reference side', async ({ page }) => {
        const requests = await mockApi(page, { compare: 'separated' })
        const modal = await openFromTeamPage(page)

        await expect(modal.getByRole('slider', { name: `Scrub both replays via ${TEAM.members[0].alias}'s delta` })).toBeVisible()
        expect(new Set(requests)).toEqual(new Set([pairKey(RUNNER.cap_id, REFERENCE.cap_id)]))
        await expect(scrubTicks(modal)).toHaveCount(21)

        await scrubTo(modal, 36.5, SPAN)
        await expect(pane(modal, TEAM.members[0].alias!)).toContainText('Different line')
        await expect(pane(modal, TEAM.members[0].alias!)).toContainText('(−14.806)')
        await expect(pane(modal, TEAM.members[1].alias!)).toContainText('S4')
        await expect(pane(modal, OTHER_SIDE_MEMBER.alias!)).toContainText('Other side')
        await expect(pane(modal, OTHER_SIDE_MEMBER.alias!).getByText(/[+−±]\d/)).toHaveCount(0)
    })
})

test.describe('screenshots', () => {
    test.use({ viewport: SCREENSHOT_VIEWPORT })

    test.beforeEach(() => {
        test.skip(test.info().project.name !== 'desktop-chromium', 'desktop screenshots only')
    })

    test('same-side pair inside a different-line band', async ({ page }) => {
        await mockApi(page, { compare: 'separated' })
        const modal = await openFromCapPage(page)
        await scrubTo(modal, 36.5, SPAN)
        await expect(pane(modal, RUNNER.alias!)).toContainText('Different line')

        await expect(modal).toHaveScreenshot('same-side-pair.png', { mask: [modal.locator('video')] })
    })

    test('mixed-side team', async ({ page }) => {
        await mockApi(page, { compare: 'separated' })
        const modal = await openFromTeamPage(page)
        await scrubTo(modal, 36.5, SPAN)
        await expect(pane(modal, OTHER_SIDE_MEMBER.alias!)).toContainText('Other side')

        await expect(modal).toHaveScreenshot('mixed-side-team.png', { mask: [modal.locator('video')] })
    })
})
