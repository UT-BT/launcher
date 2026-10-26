import { expect, test, type Page } from '@playwright/test'
import { STREAM_MATCH_ID, idleHotState, streamHotState, streamMapScore, streamMatch, streamScore } from '../app/components/stream/data/streamFixtures'
import type { StreamHotState } from '../app/components/stream/data/streamHotState'
import type { BettingRead } from '../app/components/stream/scenes/betting/bettingRead'
import { bettingMarketRead, bettingRead } from '../app/components/stream/scenes/betting/bettingFixtures'
import { SCENE_SLUG, expectSceneScreenshot, openScene, scenePath } from './streamHarness'

const BETTING_PATH = `/tournaments/${SCENE_SLUG}/stream/matches/${STREAM_MATCH_ID}/betting`
const CURRENT = streamHotState({ reason: 'current', match: streamMatch({ reason: 'current', status: 'in_progress' }) })
const NEXT = streamHotState()
const DECIDED = streamHotState({
    reason: 'holding-finished',
    match: streamMatch({
        reason: 'holding-finished',
        status: 'in_progress',
        score: streamScore([streamMapScore(0, [2, 0], 'b'), streamMapScore(1, [2, 1], 'b'), streamMapScore(2, [2, 0], 'b')], { winner: 'b', live_decided: true }),
    }),
})

async function openBetting(page: Page, read: BettingRead, hotState: StreamHotState = CURRENT, query?: string) {
    const api = await openScene(page, 'betting', { hotState, reads: { [BETTING_PATH]: read }, query })
    await expect(page.locator('[data-betting-kind], [data-betting-not-enabled]')).toBeVisible()
    return api
}

async function expectInsideBody(page: Page) {
    const body = await page.locator('main').boundingBox()
    const parts = await page.locator('[data-betting-side] li, [data-betting-side] p').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().bottom))
    expect(body).not.toBeNull()
    expect(Math.max(...parts)).toBeLessThanOrEqual((body?.y ?? 0) + (body?.height ?? 0))
}

test('an open market shows totals and prices across the full width, and no bettor', async ({ page }) => {
    await openBetting(page, bettingRead('open'), NEXT)

    await expect(page.locator('[data-betting-kind="open"]')).toBeVisible()
    await expect(page.getByText('Market open')).toBeVisible()
    await expect(page.getByText('14,750 coins · 164 predictions')).toBeVisible()
    await expect(page.getByText('20:00 UTC · in 1h 20m')).toBeVisible()
    await expect(page.locator('[data-betting-side]')).toHaveCount(0)
    await expect(page.getByText('Ferrum')).toHaveCount(0)
    await expect(page.getByRole('complementary')).toHaveCount(0)

    await expectSceneScreenshot(page, 'betting-open.png')
})

test('a closed market names every bettor on every outcome, draw included, and rings the one biggest bet', async ({ page }) => {
    const read = bettingMarketRead('29/2/2', 'closed')
    await openBetting(page, read)

    await expect(page.getByText('Market closed')).toBeVisible()
    await expect(page.locator('[data-betting-side]')).toHaveText([/Crimson Cats/, /Draw/, /Azure Owls/])
    await expect(page.locator('[data-betting-side="a"]').getByRole('listitem')).toHaveCount(29)
    await expect(page.locator('[data-betting-side="draw"]').getByRole('listitem')).toHaveCount(2)
    await expect(page.locator('[data-betting-side="b"]').getByRole('listitem')).toHaveCount(2)
    await expect(page.getByText(/more · .* staked/)).toHaveCount(0)
    await expect(page.getByText('Odds 14.29 · 2 bettors · 950 staked')).toBeVisible()
    await expect(page.locator('[data-biggest-bet]')).toHaveCount(1)
    await expect(page.locator('[data-betting-legend]')).toHaveText('Biggest bet')
    await expect(page.getByText('Won', { exact: true })).toHaveCount(0)
    await expectInsideBody(page)

    await expectSceneScreenshot(page, 'betting-closed.png')
})

test('a finished match without an official result reads "awaiting result", names no winner and folds only past the floor', async ({ page }) => {
    await openBetting(page, bettingMarketRead('80/7', 'closed'), DECIDED)

    await expect(page.locator('[data-betting-kind="awaiting"]')).toBeVisible()
    await expect(page.getByText('Awaiting result')).toBeVisible()
    await expect(page.getByText('Crimson Cats vs Azure Owls · waiting for the official result')).toBeVisible()
    await expect(page.getByText('Won', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Lost', { exact: true })).toHaveCount(0)
    await expect(page.locator('[data-betting-side="a"]').getByRole('listitem')).toHaveCount(65)
    await expect(page.locator('[data-betting-side="a"]').getByText(/^\+ 15 more · [\d,]+ staked$/)).toBeVisible()
    await expect(page.locator('[data-betting-side="b"]').getByRole('listitem')).toHaveCount(7)
    await expectInsideBody(page)

    await expectSceneScreenshot(page, 'betting-awaiting.png')
})

test('an official result inside the settlement hold lights the winners and dims the losers with pending payouts', async ({ page }) => {
    await openBetting(page, bettingMarketRead('21/6/4', 'resolved'))

    await expect(page.getByText('Paying out')).toBeVisible()
    await expect(page.getByText('Crimson Cats won · payouts pending, the settlement hold ends 21:30 UTC · in 2h 50m')).toBeVisible()
    await expect(page.locator('[data-betting-side="a"]').getByText('Won', { exact: true })).toBeVisible()
    await expect(page.locator('[data-betting-side="draw"]').getByText('Lost', { exact: true })).toBeVisible()
    await expect(page.locator('[data-betting-side="b"]').getByText('Lost', { exact: true })).toBeVisible()
    await expect(page.locator('[data-betting-side="a"]').getByText('Pending')).toHaveCount(21)
    await expect(page.locator('[data-betting-tone="won"]')).toHaveCount(21)
    await expect(page.locator('[data-betting-tone="lost"]')).toHaveCount(10)
    await expectInsideBody(page)

    await expectSceneScreenshot(page, 'betting-paying-out.png')
})

test('a settled market shows paid payouts in the same rows', async ({ page }) => {
    await openBetting(page, bettingMarketRead('21/6/4', 'settled'))

    await expect(page.getByText('Crimson Cats won · all payouts paid')).toBeVisible()
    await expect(page.locator('[data-betting-side="a"]').getByText('Paid')).toHaveCount(21)
    await expect(page.locator('[data-betting-side="b"]').getByText('Paid')).toHaveCount(0)

    await expectSceneScreenshot(page, 'betting-settled.png')
})

test('a draw result lights the draw group and dims both teams', async ({ page }) => {
    await openBetting(page, bettingMarketRead('14/11/3', 'settled', 'draw'))

    await expect(page.getByText('Draw · all payouts paid')).toBeVisible()
    await expect(page.locator('[data-betting-side="draw"]').getByText('Won', { exact: true })).toBeVisible()
    await expect(page.locator('[data-betting-side="draw"] [data-betting-tone="won"]')).toHaveCount(11)
    await expect(page.locator('[data-betting-tone="lost"]')).toHaveCount(17)

    await expectSceneScreenshot(page, 'betting-draw-won.png')
})

test('a voided market gives the reason and refunds every row', async ({ page }) => {
    await openBetting(page, bettingMarketRead('21/6/4', 'voided'))

    await expect(page.getByText('The match was cancelled · all stakes refunded')).toBeVisible()
    await expect(page.locator('[data-betting-side]').getByText('Refunded', { exact: true })).toHaveCount(31)
    await expect(page.locator('[data-betting-tone]')).toHaveCount(0)
    await expect(page.getByText('Won', { exact: true })).toHaveCount(0)

    await expectSceneScreenshot(page, 'betting-voided.png')
})

test('an event without predictions shows "Predictions not enabled"', async ({ page }) => {
    await openBetting(page, bettingRead('not_enabled'))

    await expect(page.getByText('Predictions not enabled')).toBeVisible()
    await expect(page.locator('[data-scene-ticker]')).toHaveCount(1)

    await expectSceneScreenshot(page, 'betting-not-enabled.png')
})

test('the Betting scene shows the idle frame when nothing is resolved', async ({ page }) => {
    await openScene(page, 'betting', { hotState: idleHotState() })

    await expect(page.locator('[data-scene-idle]')).toHaveAttribute('data-stream-scene', 'betting')
})

test('motion=0 turns the scene motion off, and the scene never opens audio even with sound on', async ({ page }) => {
    await page.addInitScript(() => {
        const counter = window as unknown as { audioContexts: number }
        counter.audioContexts = 0
        const Original = window.AudioContext
        window.AudioContext = class extends Original {
            constructor(options?: AudioContextOptions) {
                super(options)
                counter.audioContexts += 1
            }
        }
    })
    await openBetting(page, bettingRead('open'), NEXT)
    await expect(page.locator('[data-motion]').first()).toHaveAttribute('data-motion', 'off')

    await page.goto(scenePath('betting', 'volume=80'))
    await expect(page.locator('[data-betting-kind="open"]')).toBeVisible()
    await expect(page.locator('[data-motion]').first()).toHaveAttribute('data-motion', 'on')
    await page.mouse.click(960, 540)
    expect(await page.evaluate(() => (window as unknown as { audioContexts: number }).audioContexts)).toBe(0)
})
