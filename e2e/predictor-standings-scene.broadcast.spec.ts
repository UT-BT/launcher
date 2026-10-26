import { expect, test } from '@playwright/test'
import { STREAM_MATCH_ID, idleHotState, streamHotState } from '../app/components/stream/data/streamFixtures'
import { predictorStandingsRead, withoutMovement, withoutPending } from '../app/components/stream/scenes/standings/predictorStandingsFixtures'
import { SCENE_SLUG, expectSceneScreenshot, openScene } from './streamHarness'

const MATCH_PATH = `/tournaments/${SCENE_SLUG}/stream/matches/${STREAM_MATCH_ID}/predictor-standings`
const MATCHLESS_PATH = `/tournaments/${SCENE_SLUG}/stream/predictor-standings`
const SCENE = 'predictor-standings'

test('52 predictors fit three columns of roomy rows, projected, with Pending chips and movement', async ({ page }) => {
    await openScene(page, SCENE, { hotState: streamHotState(), reads: { [MATCH_PATH]: predictorStandingsRead() } })

    const board = page.locator('[data-predictor-standings]')
    await expect(board).toHaveAttribute('data-row-height', '44')
    await expect(board).toHaveAttribute('data-columns', '3')
    await expect(page.getByRole('heading', { name: 'Predictor Standings' })).toBeVisible()
    await expect(page.getByText('Projected', { exact: true })).toBeVisible()
    await expect(page.locator('[data-standings-row]')).toHaveCount(52)
    await expect(page.locator('[data-standings-more]')).toHaveCount(0)
    await expect(page.locator('[data-standings-row="1"]')).toContainText('Oriel')
    await expect(page.locator('[data-standings-row="1"]')).toContainText('High Roller')
    await expect(page.locator('[data-standings-row="1"]')).toContainText('+6,185')
    await expect(page.locator('[data-standings-row="31"]')).toContainText('▲8')
    await expect(page.locator('[data-standings-row="31"]')).toContainText('Pending')
    await expect(page.locator('[data-standings-row="52"]')).toContainText('−5,004')
    await expect(page.locator('[data-standings-row="52"]')).toContainText('6/20')
    await expect(page.locator('[data-standings-move="new"]')).toHaveCount(2)
    await expect(page.locator('[data-standings-move="down"]').first()).toBeVisible()
    await expect(page.locator('[data-standings-move="same"]').first()).toBeVisible()

    await expectSceneScreenshot(page, 'predictor-standings-projected.png')
})

test('120 predictors drop to the 30 px floor in four columns and fold the last 17', async ({ page }) => {
    await openScene(page, SCENE, { hotState: streamHotState(), reads: { [MATCH_PATH]: predictorStandingsRead({ count: 120 }) } })

    const board = page.locator('[data-predictor-standings]')
    await expect(board).toHaveAttribute('data-row-height', '30')
    await expect(board).toHaveAttribute('data-columns', '4')
    await expect(page.locator('[data-standings-row]')).toHaveCount(103)
    await expect(page.locator('[data-standings-more]')).toHaveText('+ 17 more predictors')
    const more = await page.locator('[data-standings-more]').boundingBox()
    expect(more && more.y + more.height).toBeLessThanOrEqual(168 + 824)

    await expectSceneScreenshot(page, 'predictor-standings-floor.png')
})

test('with no match the scene reads the match-less standings: no kicker, no movement', async ({ page }) => {
    await openScene(page, SCENE, { hotState: idleHotState(), reads: { [MATCHLESS_PATH]: withoutPending(withoutMovement(predictorStandingsRead({ count: 12 }))) } })

    await expect(page.locator('[data-standings-row]')).toHaveCount(12)
    await expect(page.getByText('Projected', { exact: true })).toHaveCount(0)
    await expect(page.locator('[data-standings-move]')).toHaveCount(0)
    await expect(page.getByText('Pending', { exact: true })).toHaveCount(0)
})

test('an event nobody has predicted on yet says so', async ({ page }) => {
    await openScene(page, SCENE, { hotState: streamHotState(), reads: { [MATCH_PATH]: predictorStandingsRead({ items: [] }) } })

    await expect(page.locator('[data-predictor-standings="empty"]')).toHaveText('No predictions yet')
})
