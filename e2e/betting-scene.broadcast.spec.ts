import { expect, test, type Page } from '@playwright/test'
import { STREAM_MATCH_ID, idleHotState, streamHotState, streamMapScore, streamMatch, streamScore } from '../app/components/stream/data/streamFixtures'
import type { StreamHotState } from '../app/components/stream/data/streamHotState'
import type { BettingRead } from '../app/components/stream/scenes/betting/bettingRead'
import { bettingRead } from '../app/components/stream/scenes/betting/bettingFixtures'
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

test('an open market shows totals, prices and the leaderboard, and no bettor', async ({ page }) => {
    await openBetting(page, bettingRead('open'), NEXT)

    await expect(page.locator('[data-betting-kind="open"]')).toBeVisible()
    await expect(page.getByText('Market open')).toBeVisible()
    await expect(page.getByText('14,750 coins · 164 predictions')).toBeVisible()
    await expect(page.getByText('20:00 UTC · in 1h 20m')).toBeVisible()
    await expect(page.locator('[data-betting-side]')).toHaveCount(0)
    await expect(page.getByText('Ferrum')).toHaveCount(0)
    await expect(page.getByRole('complementary', { name: 'Top predictors' }).getByRole('listitem')).toHaveCount(5)

    await expectSceneScreenshot(page, 'betting-open.png')
})

test('a closed market names the bettors and highlights the one biggest bet', async ({ page }) => {
    await openBetting(page, bettingRead('closed'))

    await expect(page.getByText('Market closed')).toBeVisible()
    const a = page.locator('[data-betting-side="a"]')
    const b = page.locator('[data-betting-side="b"]')
    await expect(a.getByRole('listitem')).toHaveCount(5)
    await expect(a.getByText('+ 61 more · 3,270 staked')).toBeVisible()
    await expect(a.getByText('Odds 1.72 · 66 bettors · 6,420 staked')).toBeVisible()
    await expect(page.locator('[data-biggest-bet]')).toHaveCount(1)
    await expect(b.locator('[data-biggest-bet]')).toContainText('Harbinger')
    await expect(page.getByText('Won', { exact: true })).toHaveCount(0)

    await expectSceneScreenshot(page, 'betting-closed.png')
})

test('a finished match without an official result reads "awaiting result" and names no winner', async ({ page }) => {
    await openBetting(page, bettingRead('closed'), DECIDED)

    await expect(page.locator('[data-betting-kind="awaiting"]')).toBeVisible()
    await expect(page.getByText('Awaiting official result')).toBeVisible()
    await expect(page.getByText('Won', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Lost', { exact: true })).toHaveCount(0)
    await expect(page.getByText(/Azure Owls won/)).toHaveCount(0)
})

test('an official result inside the settlement hold shows won/lost, profit and pending payouts', async ({ page }) => {
    await openBetting(page, bettingRead('resolved'))

    await expect(page.getByText('Paying out')).toBeVisible()
    await expect(page.getByText('Crimson Cats won · payouts pending, the settlement hold ends 21:30 UTC · in 2h 50m')).toBeVisible()
    await expect(page.locator('[data-betting-side="a"]').getByText('Won', { exact: true })).toBeVisible()
    await expect(page.locator('[data-betting-side="b"]').getByText('Lost', { exact: true })).toBeVisible()
    await expect(page.locator('[data-betting-side="a"]').getByText('Pending')).toHaveCount(5)
    await expect(page.locator('[data-betting-side="a"]').getByText('+1,110')).toBeVisible()
})

test('a settled market shows paid payouts', async ({ page }) => {
    await openBetting(page, bettingRead('settled'))

    await expect(page.getByText('Crimson Cats won · all payouts paid')).toBeVisible()
    await expect(page.locator('[data-betting-side="a"]').getByText('Paid')).toHaveCount(5)
    await expect(page.locator('[data-betting-side="b"]').getByText('−3,000')).toBeVisible()

    await expectSceneScreenshot(page, 'betting-settled.png')
})

test('an event without predictions shows "Predictions not enabled" and no leaderboard', async ({ page }) => {
    await openBetting(page, bettingRead('not_enabled'))

    await expect(page.getByText('Predictions not enabled')).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Top predictors' })).toHaveCount(0)
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
