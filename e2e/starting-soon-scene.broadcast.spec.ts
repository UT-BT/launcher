import { expect, test, type Page } from '@playwright/test'
import { STREAM_MATCH_ID, STREAM_T0, streamHotState } from '../app/components/stream/data/streamFixtures'
import { soonBetting, soonBettingDisabled, soonFeed, soonMatch } from '../app/components/stream/scenes/startingSoon/startingSoonFixtures'
import { SCENE_SLUG, SCENE_STREAMER, expectSceneScreenshot, openScene } from './streamHarness'

const BETTING = `/tournaments/${SCENE_SLUG}/stream/matches/${STREAM_MATCH_ID}/betting`
const FEED = `/tournaments/${SCENE_SLUG}/stream/feed?streamer=${SCENE_STREAMER}`
const START = STREAM_T0 + 80 * 60_000
const HOT_STATE = streamHotState({ match: soonMatch() })

function reads(betting = soonBetting()) {
    return { [BETTING]: betting, [FEED]: soonFeed() }
}

function countReads(page: Page): { betting: () => number; feed: () => number } {
    const counts = { betting: 0, feed: 0 }
    page.on('request', request => {
        const { pathname } = new URL(request.url())
        if (request.method() !== 'GET') return
        if (pathname.endsWith(`/matches/${STREAM_MATCH_ID}/betting`)) counts.betting += 1
        if (pathname.endsWith('/stream/feed')) counts.feed += 1
    })
    return { betting: () => counts.betting, feed: () => counts.feed }
}

test('Starting Soon shows the countdown, both teams, the odds and the rest of the day', async ({ page }) => {
    await openScene(page, 'starting-soon', { hotState: HOT_STATE, reads: reads() })

    const scene = page.locator('[data-stream-scene="starting-soon"]')
    await expect(scene.locator('[data-soon-countdown="future"]')).toHaveText('1:20:00')
    await expect(scene.getByRole('banner')).toContainText('20:00 UTC · in 1h 20m')
    await expect(scene.getByRole('main')).toContainText('20:00 UTC · in 1h 20m')
    await expect(scene.getByRole('region', { name: 'Crimson Cats' })).toContainText('Seed 1')
    await expect(scene.getByRole('region', { name: 'Azure Owls' })).toContainText('Seed 4')
    await expect(scene.getByText('Cap Machine')).toBeVisible()
    await expect(scene.locator('[data-soon-odds="A"]')).toHaveText('A58%1.72')
    await expect(scene.getByText('164 predictions · 12,450 coins in the pool')).toBeVisible()
    await expect(scene.locator('[data-soon-also]')).toHaveCount(5)
    await expect(scene.locator('[data-soon-also="u1"]')).toContainText('twitch.tv/utbt')

    const [a, b] = await Promise.all([page.locator('[data-soon-team="a"]').boundingBox(), page.locator('[data-soon-team="b"]').boundingBox()])
    expect(a!.y).toBeLessThan(b!.y)

    await expectSceneScreenshot(page, 'starting-soon.png')
})

test('Starting Soon hides the odds bar when predictions are not enabled', async ({ page }) => {
    await openScene(page, 'starting-soon', { hotState: HOT_STATE, reads: reads(soonBettingDisabled()) })

    await expect(page.locator('[data-soon-also]')).toHaveCount(5)
    await expect(page.getByText('Community odds')).toHaveCount(0)

    await expectSceneScreenshot(page, 'starting-soon-no-predictions.png')
})

test('Starting Soon reads "any moment" once the start has passed, instead of sitting at zero', async ({ page }) => {
    await openScene(page, 'starting-soon', { hotState: HOT_STATE, reads: reads(), at: START + 3 * 60_000 })

    await expect(page.locator('[data-soon-countdown="passed"]')).toHaveText('Any moment', { ignoreCase: true })
    await expect(page.getByText('20:00 UTC · starting any moment')).toBeVisible()

    await expectSceneScreenshot(page, 'starting-soon-past-zero.png')
})

test('the countdown turns to "any moment" when it reaches zero, without a reload', async ({ page }) => {
    await openScene(page, 'starting-soon', { hotState: HOT_STATE, reads: reads(), at: START - 3_000, query: 'sound=0&motion=0&preview=1' })
    await expect(page.locator('[data-soon-countdown="future"]')).toHaveText('0:00:03')

    await page.clock.setFixedTime(START + 1_000)
    await expect(page.locator('[data-soon-countdown="passed"]')).toHaveText('Any moment', { ignoreCase: true })
})

test('the betting and feed reads follow the composite cadence and refetch when the source goes on program', async ({ page }) => {
    await page.addInitScript(() => { (window as unknown as { obsstudio: object }).obsstudio = {} })
    const counts = countReads(page)
    await openScene(page, 'starting-soon', { hotState: HOT_STATE, reads: reads() })
    await expect(page.locator('[data-soon-also]')).toHaveCount(5)
    await page.waitForTimeout(1_000)
    const loaded = { betting: counts.betting(), feed: counts.feed() }
    expect(loaded.betting).toBeGreaterThan(0)
    expect(loaded.feed).toBeGreaterThan(0)

    await page.waitForTimeout(4_000)
    expect(counts.betting()).toBe(loaded.betting)
    expect(counts.feed()).toBe(loaded.feed)

    await page.evaluate(() => window.dispatchEvent(new CustomEvent('obsSourceActiveChanged', { detail: { active: true } })))
    await expect.poll(counts.betting, { timeout: 1_000 }).toBe(loaded.betting + 1)
    await expect.poll(counts.feed, { timeout: 1_000 }).toBe(loaded.feed + 1)
    await page.waitForTimeout(3_000)
    expect(counts.betting()).toBe(loaded.betting + 1)
})
