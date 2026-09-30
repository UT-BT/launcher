import { expect, test } from '@playwright/test'
import { streamMapScore, streamScore } from '../app/components/stream/data/streamFixtures'
import { MID_SERIES, intermissionHotState } from '../app/components/stream/scenes/intermission/intermissionFixtures'
import { expectSceneScreenshot, openScene } from './streamHarness'

const FINISHED = intermissionHotState([], {
    score: streamScore(
        [streamMapScore(0, [2, 1], 'a'), streamMapScore(1, [0, 2], 'b'), streamMapScore(2, [2, 1], 'a'), streamMapScore(3, [2, 0], 'a', { source: 'live' })],
        { winner: 'a', live_decided: true },
    ),
})

test('mid-series, the Intermission scene shows caps per map and an up next line, with no next-map card or side chips', async ({ page }) => {
    await openScene(page, 'intermission', { hotState: intermissionHotState(MID_SERIES) })

    await expect(page.locator('[data-up-next]')).toHaveText('Up next: II-FaithCB · picked by Crimson Cats')
    await expect(page.locator('[data-next-map]')).toHaveCount(0)
    await expect(page.getByText('Lineup PBs on this map')).toHaveCount(0)
    await expect(page.getByText(/^[ab]$/i)).toHaveCount(0)
    await expect(page.locator('[data-series-side="a"]')).toHaveText('2')
    await expect(page.getByText('Series 2–1 · map 4 next')).toBeVisible()
    await expect(page.locator('[data-map-column="3"]')).toContainText('Just decided')
    await expect(page.locator('[data-map-column="4"]')).toContainText('Up next')
    await expect(page.locator('[data-map-revealing]')).toHaveCount(0)

    await expectSceneScreenshot(page, 'intermission-mid-series.png')
})

test('once every map is decided, the Intermission scene shows the final series instead of a next map', async ({ page }) => {
    await openScene(page, 'intermission', { hotState: FINISHED })

    const final = page.locator('[data-series-final="a"]')
    await expect(final).toContainText('Crimson Cats')
    await expect(final).toContainText('Unofficial')
    await expect(page.locator('[data-next-map]')).toHaveCount(0)
    await expect(page.locator('[data-up-next]')).toHaveCount(0)
    await expect(page.getByText('Series 3–1 · final')).toBeVisible()
    await expect(page.locator('[data-map-revealing]')).toHaveCount(0)

    await expectSceneScreenshot(page, 'intermission-all-decided.png')
})

test('a map decided while the scene runs is revealed once, and a reload does not reveal it again', async ({ page }) => {
    const api = await openScene(page, 'intermission', { hotState: intermissionHotState([[2, 1, 'a'], [0, 2, 'b']]) })
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
