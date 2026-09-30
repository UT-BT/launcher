import { expect, test, type Page } from '@playwright/test'
import {
    STREAM_EVENT,
    STREAM_STREAMER_ID,
    STREAM_T0,
    idleHotState,
    streamHotState,
    streamMapScore,
    streamMatch,
    streamScore,
} from '../app/components/stream/data/streamFixtures'
import { feedMatch, feedPredictor, feedResult, streamFeed } from '../app/components/stream/ticker/feedFixtures'
import { TICKER_SET_MS } from '../app/components/stream/ticker/tickerTiming'
import { TICKER_STRIP, expectSceneScreenshot, openScene, settleScene } from './streamHarness'

const HOUR = 3_600_000
const FEED_PATH = `/tournaments/${STREAM_EVENT.slug}/stream/feed?streamer=${STREAM_STREAMER_ID}`
const TICKER_SETS = ['results', 'upcoming', 'predictors', 'next'] as const

const HOT_STATE = streamHotState({
    reason: 'holding-finished',
    streamer: { id: STREAM_STREAMER_ID, display_name: 'Bramble', channel: 'https://twitch.tv/bramble_bt' },
    match: streamMatch({
        reason: 'holding-finished',
        status: 'complete',
        casters: [
            { id: '300000000000000001', display_name: 'Echo', avatar: 'https://example.test/users/300000000000000001/avatar' },
            { id: null, display_name: 'Tilde', avatar: null },
        ],
        score: streamScore([streamMapScore(0, [3, 1], 'a'), streamMapScore(1, [3, 0], 'a')], { winner: 'a' }),
    }),
})

const UPCOMING = [
    feedMatch('u1', 'Strafe Society', 'Quad Damage', STREAM_T0 + 2 * HOUR + 50 * 60_000, {
        stream_url: 'https://twitch.tv/utbt',
        round: { no: 4, label: 'Round 4' },
        stage: { key: 'group', name: 'Group C' },
    }),
    feedMatch('u2', 'Burrow Gang', 'Flagrunners', STREAM_T0 + 3 * HOUR + 20 * 60_000, { stream_url: 'https://twitch.tv/bramble_bt' }),
    feedMatch('u3', 'Ctrl+Hop', 'Velvet Carrots', STREAM_T0 + 4 * HOUR + 50 * 60_000),
]

const FEED = streamFeed(STREAM_T0, {
    results: [
        feedResult('r1', 'Kinetic Kin', 'Triple Jump', STREAM_T0 - 4 * HOUR, [3, 1]),
        feedResult('r2', 'Warp Rabbits', 'Ledge Lords', STREAM_T0 - 3 * HOUR, [3, 1]),
        feedResult('r3', 'Moonhoppers', 'Double Dash', STREAM_T0 - 2 * HOUR, [2, 2]),
    ],
    upcoming: UPCOMING,
    top_predictors: [
        feedPredictor(1, '400000000000000001', 'Harbinger', 18420),
        feedPredictor(2, '400000000000000002', 'Nimbus', 12905),
        feedPredictor(3, '400000000000000003', 'Tessel', 9310),
    ],
    next_match: UPCOMING[1],
})

function atShowing(index: number, sets = 4): number {
    const first = Math.floor(STREAM_T0 / TICKER_SET_MS)
    const slot = first + ((index - (first % sets) + sets) % sets)
    return slot * TICKER_SET_MS
}

async function openEnding(page: Page, at = STREAM_T0, query?: string) {
    return openScene(page, 'ending', { hotState: HOT_STATE, reads: { [FEED_PATH]: FEED }, at, query })
}

test('the Ending scene shows the credits and the next streamed matches with channels', async ({ page }) => {
    await openEnding(page)
    const scene = page.locator('[data-stream-scene="ending"]')

    await expect(scene.getByRole('heading', { name: 'Thanks for watching' })).toBeVisible()
    await expect(scene.getByText('Crimson Cats 2–0 Azure Owls')).toBeVisible()

    const credits = scene.getByRole('region', { name: 'Credits' })
    await expect(credits.getByText('Bramble')).toBeVisible()
    await expect(credits.getByText('Echo')).toBeVisible()
    await expect(credits.getByText('Tilde')).toBeVisible()
    await expect(credits.getByText(STREAM_EVENT.name)).toBeVisible()

    const rows = scene.getByRole('region', { name: 'Next streamed matches' }).getByRole('listitem')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('Strafe Society')
    await expect(rows.nth(0)).toContainText('twitch.tv/utbt')
    await expect(rows.nth(1)).toContainText('twitch.tv/bramble_bt')
    await expect(rows.nth(1)).toContainText('This channel')

    await expectSceneScreenshot(page, 'ending.png')
})

test('the Ending scene still shows the credits when the feed is unavailable', async ({ page }) => {
    await openScene(page, 'ending', { hotState: HOT_STATE })
    const scene = page.locator('[data-stream-scene="ending"]')

    await expect(scene.getByRole('region', { name: 'Credits' }).getByText('Bramble')).toBeVisible()
    await expect(scene.getByText('No streamed matches scheduled yet')).toBeVisible()
    await expect(scene.locator('[data-ticker-set]')).toHaveCount(0)
})

test('the Ending scene shows the credits without a resolved match', async ({ page }) => {
    await openScene(page, 'ending', { hotState: idleHotState(), reads: { [FEED_PATH]: FEED } })
    const credits = page.getByRole('region', { name: 'Credits' })

    await expect(page.getByRole('heading', { name: 'Thanks for watching' })).toBeVisible()
    await expect(credits.getByText(STREAM_EVENT.name)).toBeVisible()
    await expect(credits.getByText('Casters')).toHaveCount(0)
})

for (const [index, kind] of TICKER_SETS.entries()) {
    test(`the ticker strip shows the ${kind} set`, async ({ page }) => {
        await openEnding(page, atShowing(index))
        const ticker = page.locator('[data-scene-ticker]')

        await expect(ticker.locator(`[data-ticker-set="${kind}"]`)).toBeVisible()
        await settleScene(page)
        await expect(page).toHaveScreenshot(`ticker-${kind}.png`, { clip: TICKER_STRIP })
    })
}

test('the ticker renders nothing when the feed has nothing to show', async ({ page }) => {
    await openScene(page, 'ending', { hotState: HOT_STATE, reads: { [FEED_PATH]: streamFeed(STREAM_T0) } })

    await expect(page.getByRole('region', { name: 'Credits' })).toBeVisible()
    await expect(page.locator('[data-scene-ticker]')).toBeEmpty()
})

test('the predictors set is left out without predictions', async ({ page }) => {
    await openScene(page, 'ending', {
        hotState: HOT_STATE,
        reads: { [FEED_PATH]: { ...FEED, top_predictors: null } },
        at: atShowing(2, 3),
    })

    await expect(page.locator('[data-ticker-set="next"]')).toBeVisible()
    await expect(page.locator('[data-ticker-set="predictors"]')).toHaveCount(0)
})

test('motion=0 keeps the ticker free of running animations', async ({ page }) => {
    await openEnding(page)
    const ticker = page.locator('[data-scene-ticker]')
    await expect(ticker.locator('[data-ticker-set]')).toBeVisible()

    expect(await ticker.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0)
    await expect(page.locator('[data-motion]').first()).toHaveAttribute('data-motion', 'off')

    await page.goto(page.url().replace('motion=0', 'motion=1'))
    await expect(page.locator('[data-motion]').first()).toHaveAttribute('data-motion', 'on')
})
