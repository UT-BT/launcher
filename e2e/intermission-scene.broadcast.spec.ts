import { expect, test } from '@playwright/test'
import { STREAM_MATCH_ID, streamMapScore, streamScore } from '../app/components/stream/data/streamFixtures'
import { MID_SERIES, intermissionHotState, intermissionRead } from '../app/components/stream/scenes/intermission/intermissionFixtures'
import { SCENE_SLUG, expectSceneScreenshot, openScene } from './streamHarness'

const NEXT_READ = { [`/tournaments/${SCENE_SLUG}/stream/matches/${STREAM_MATCH_ID}/intermission/4`]: intermissionRead() }

const FINISHED = intermissionHotState([], {
    score: streamScore(
        [streamMapScore(1, [2, 1], 'a'), streamMapScore(2, [0, 2], 'b'), streamMapScore(3, [2, 1], 'a'), streamMapScore(4, [2, 0], 'a', { source: 'live' })],
        { winner: 'a', live_decided: true },
    ),
})

test('mid-series, the Intermission scene shows caps per map and the next-map card', async ({ page }) => {
    await openScene(page, 'intermission', { hotState: intermissionHotState(MID_SERIES), reads: NEXT_READ })

    const card = page.locator('[data-next-map="4"]')
    await expect(card.getByText('RoelerCoaster')).toBeVisible()
    await expect(card.getByText('Picked by Crimson Cats')).toBeVisible()
    await expect(card.getByText('1:37.26')).toBeVisible()
    await expect(card.locator('[data-pb-slot="a1"]')).toContainText('1:41.87')
    await expect(card.locator('[data-pb-slot="b1"]')).toContainText('Pending')
    await expect(card.locator('[data-pb-slot="b2"]')).toContainText('No time yet')
    await expect(page.getByText('Series 2–1 · map 4 next')).toBeVisible()
    await expect(page.locator('[data-map-column="3"]')).toContainText('Just decided')
    await expect(page.locator('[data-map-column="4"]')).toContainText('Up next')
    await expect(page.locator('[data-map-revealing]')).toHaveCount(0)

    await expectSceneScreenshot(page, 'intermission-mid-series.png')
})

test('once every map is decided, the Intermission scene shows the final series instead of a next map', async ({ page }) => {
    await openScene(page, 'intermission', { hotState: FINISHED, reads: NEXT_READ })

    const final = page.locator('[data-series-final="a"]')
    await expect(final).toContainText('Crimson Cats')
    await expect(final).toContainText('Unofficial')
    await expect(page.locator('[data-next-map]')).toHaveCount(0)
    await expect(page.getByText('Series 3–1 · final')).toBeVisible()
    await expect(page.locator('[data-map-revealing]')).toHaveCount(0)

    await expectSceneScreenshot(page, 'intermission-all-decided.png')
})

test('a map decided while the scene runs is revealed once, and a reload does not reveal it again', async ({ page }) => {
    const api = await openScene(page, 'intermission', { hotState: intermissionHotState([[2, 1, 'a'], [0, 2, 'b']]), reads: NEXT_READ })
    await expect(page.locator('[data-map-column="3"]')).toHaveAttribute('data-map-status', 'next')
    await expect(page.locator('[data-map-revealing]')).toHaveCount(0)

    api.setHotState(intermissionHotState(MID_SERIES))
    await expect(page.locator('[data-map-column="3"]')).toHaveAttribute('data-map-revealing', '1')
    await expect(page.locator('[data-map-headline="3"]')).toContainText('Crimson Cats take map 3')
    await expect(page.locator('[data-map-revealing]')).toHaveCount(1)

    await page.reload()
    await expect(page.locator('[data-map-column="3"]')).toHaveAttribute('data-map-status', 'decided')
    await expect(page.locator('[data-map-revealing]')).toHaveCount(0)
})
