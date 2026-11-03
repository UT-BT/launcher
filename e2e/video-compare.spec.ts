import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
    RUN_COMPARE_FIXTURES,
    runCompareErrors,
    runCompareFixture,
    type RunCompareComparisonName,
} from '../app/utils/fixtures/runCompareFixtures'
import type { CapCheckpoint, CapComparisonErrorCode, CapDetail, TeamCapDetail, TeamCapDetailMember } from '../app/utils/api'
import { defaultCompareCandidate } from '../app/components/pages/capDetail/runDelta/compareCandidates'

const VIDEO = readFileSync(resolve(__dirname, 'next-map-flythrough.webm'))
const AVATAR = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const MEDIA_HOST = 'https://media.replays.test'
const VIDEO_TAIL_SECONDS = 1
const HAVE_NOTHING = 0
const NETWORK_EMPTY = 0

const separated = runCompareFixture('separated')
const RUNNER = separated.runner
const REFERENCE = separated.reference
const RUNNER_DETAIL = runCompareFixture('capDetailCandidates')
const MAP = RUNNER_DETAIL.cap.map
const TEAM = runCompareFixture('teamCapDetailMembers')
const OTHER_SIDE_MEMBER = TEAM.members[2]
const FOURTH_MEMBER = {
    ...OTHER_SIDE_MEMBER,
    cap_id: 'f0f0f0f0-0000-4000-8000-000000000004',
    user: '700000000000000004',
    alias: 'Nova.pX7',
    cap_time_seconds: 69.5,
}

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
    fourMembers?: boolean
}

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

function otherSideDetail(member: TeamCapDetailMember = OTHER_SIDE_MEMBER): CapDetail {
    return {
        ...RUNNER_DETAIL,
        cap: { ...RUNNER_DETAIL.cap, ...member.cap, id: member.cap_id, team: 1 },
        compare_candidates: [],
    }
}

function fourthMember(): TeamCapDetailMember {
    return {
        ...FOURTH_MEMBER,
        cap: FOURTH_MEMBER.cap && {
            ...FOURTH_MEMBER.cap,
            id: FOURTH_MEMBER.cap_id,
            user: FOURTH_MEMBER.user,
            alias: FOURTH_MEMBER.alias,
            cap_time_seconds: FOURTH_MEMBER.cap_time_seconds,
            team: 1,
        },
    }
}

function teamDetail(fourMembers: boolean): TeamCapDetail {
    const [first, second, third] = TEAM.members
    return {
        ...TEAM,
        team_time_seconds: REFERENCE.cap_time_ms / 1000,
        team_size: fourMembers ? 4 : TEAM.team_size,
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
            ...(fourMembers ? [fourthMember()] : []),
        ],
    }
}

function leaderboardEntry(id: string, user: string, alias: string | null, seconds: number, team: number) {
    return { map: MAP, user, cap_time_seconds: seconds, added: '2026-09-01T12:00:00', alias, cap_type: 0, verified: true, id, team, active_title: null }
}

function capTimeOf(capId: string): number {
    if (capId === RUNNER.cap_id) return RUNNER.cap_time_ms / 1000
    if (capId === REFERENCE.cap_id) return REFERENCE.cap_time_ms / 1000
    if (capId === FOURTH_MEMBER.cap_id) return FOURTH_MEMBER.cap_time_seconds
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
        [FOURTH_MEMBER.cap_id, otherSideDetail(fourthMember())],
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
        if (path === `/caps/team_caps/${TEAM.id}/detail`) return ok(teamDetail(setup.fourMembers ?? false))
        if (path === `/caps/leaderboard/map/${MAP}`) return ok(leaderboard)

        return ok([])
    })
    return compareRequests
}

interface PlayTally {
    plays: number
    mostPlaying: number
}

async function trackPlayingVideos(page: Page) {
    await page.addInitScript(() => {
        const seen = new Set<HTMLVideoElement>()
        const tally: PlayTally = { plays: 0, mostPlaying: 0 }
        Object.assign(window, { playTally: tally })
        document.addEventListener('play', event => {
            if (!(event.target instanceof HTMLVideoElement)) return
            seen.add(event.target)
            tally.plays += 1
            tally.mostPlaying = Math.max(tally.mostPlaying, Array.from(seen).filter(video => !video.paused).length)
        }, true)
    })
}

async function playTallyAfter(page: Page, plays: number): Promise<PlayTally> {
    const read = () => page.evaluate(() => (window as Window & { playTally?: PlayTally }).playTally ?? { plays: 0, mostPlaying: 0 })
    await expect.poll(async () => (await read()).plays).toBeGreaterThanOrEqual(plays)
    return read()
}

function videosPlaying(scope: Locator): Promise<number> {
    return scope.locator('video').evaluateAll(videos => videos.filter(video => !(video as HTMLVideoElement).paused).length)
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

async function playAtQuarterSpeed(modal: Locator) {
    await modal.getByRole('button', { name: 'Playback speed 0.25×' }).click()
    await modal.getByRole('button', { name: 'Play', exact: true }).click()
}

function posters(scope: Locator): Locator {
    return scope.getByRole('button', { name: /^Watch / })
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
        await expect(pane(modal, RUNNER.alias!)).toContainText('(−14.726)')
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
        await expect(pane(modal, TEAM.members[0].alias!)).toContainText('(−14.726)')
        await expect(pane(modal, TEAM.members[1].alias!)).toContainText('S4')
        await expect(pane(modal, OTHER_SIDE_MEMBER.alias!)).toContainText('Other side')
        await expect(pane(modal, OTHER_SIDE_MEMBER.alias!).getByText(/[+−±]\d/)).toHaveCount(0)
    })
})

test.describe('video playback', () => {
    test('the replay player and every compare video play inline', async ({ page }) => {
        await mockApi(page, { compare: 'separated', fourMembers: true })
        await page.goto(`/caps/${RUNNER.cap_id}`)
        await page.getByRole('button', { name: 'Watch Replay' }).click()
        const player = page.locator('[data-modal-backdrop] > div').filter({ hasText: 'Replay —' }).locator('video')
        await expect(player).toHaveCount(1)
        await expect(player).toHaveAttribute('playsinline')

        const pair = await openFromCapPage(page)
        await expect(pair.locator('video')).toHaveCount(2)
        for (const video of await pair.locator('video').all()) await expect(video).toHaveAttribute('playsinline')

        const team = await openFromTeamPage(page)
        await expect(team.locator('video').first()).toBeAttached()
        for (const video of await team.locator('video').all()) await expect(video).toHaveAttribute('playsinline')
    })

    test('a touch device plays two team videos at most and swaps a tapped poster in', async ({ page, hasTouch }) => {
        test.skip(!hasTouch, 'the two-video cap is for touch devices')
        await trackPlayingVideos(page)
        await mockApi(page, { compare: 'separated', fourMembers: true })
        const modal = await openFromTeamPage(page)
        const [runner, reference] = TEAM.members.map(m => pane(modal, m.alias!))
        const fourth = pane(modal, FOURTH_MEMBER.alias)

        await expect(modal.locator('video')).toHaveCount(2)
        await expect(runner.locator('video')).toHaveCount(1)
        await expect(reference.locator('video')).toHaveCount(1)
        await expect(posters(modal)).toHaveCount(2)

        await playAtQuarterSpeed(modal)
        await expect.poll(() => videosPlaying(modal)).toBe(2)
        const replaced = await runner.locator('video').elementHandle()

        await posters(fourth).tap()
        await expect(fourth.locator('video')).toHaveCount(1)
        await expect.poll(() => videosPlaying(fourth)).toBe(1)
        await expect.poll(() => videosPlaying(reference)).toBe(1)
        await expect(runner.locator('video')).toHaveCount(0)
        await expect(posters(runner)).toHaveCount(1)
        expect(await replaced!.evaluate(video => {
            const { paused, readyState, networkState } = video as HTMLVideoElement
            return { paused, readyState, networkState }
        })).toEqual({ paused: true, readyState: HAVE_NOTHING, networkState: NETWORK_EMPTY })
        expect((await playTallyAfter(page, 3)).mostPlaying).toBe(2)
    })

    test('desktop plays every team video', async ({ page, hasTouch }) => {
        test.skip(hasTouch, 'desktop has no video cap')
        await trackPlayingVideos(page)
        await mockApi(page, { compare: 'separated', fourMembers: true })
        const modal = await openFromTeamPage(page)

        await expect(modal.locator('video')).toHaveCount(4)
        await expect(posters(modal)).toHaveCount(0)
        await playAtQuarterSpeed(modal)
        await expect.poll(() => videosPlaying(modal)).toBe(4)
        expect((await playTallyAfter(page, 4)).mostPlaying).toBe(4)
    })
})
