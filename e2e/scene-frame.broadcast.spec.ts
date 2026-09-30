import path from 'node:path'
import { expect, test } from '@playwright/test'
import { STREAM_T0, streamHotState } from '../app/components/stream/data/streamFixtures'
import { TICKER_STRIP, expectSceneScreenshot, serveStreamApi, tickerMask } from './streamHarness'

const HARNESS = `/@fs/${path.resolve(__dirname, 'sceneFrameHarness.html').replace(/\\/g, '/').replace(/^\/+/, '')}`

test('the scene frame carries the branding, the stage line, the title and the ticker strip', async ({ page }) => {
    await page.clock.setFixedTime(STREAM_T0)
    await serveStreamApi(page, { hotState: streamHotState() })
    await page.goto(`${HARNESS}?motion=0&kicker=${encodeURIComponent('20:00 UTC · in 1h 20m')}`)

    const frame = page.locator('[data-stream-scene="starting-soon"]')
    await expect(frame.getByText('UTBT 2v2 World Cup 2026')).toBeVisible()
    await expect(frame.getByText('Group Stage · Group B · Round 4')).toBeVisible()
    await expect(frame.getByRole('heading', { level: 1, name: 'Starting Soon' })).toBeVisible()
    await expect(frame.locator('[data-probe]')).toBeVisible()

    const [ticker] = tickerMask(page)
    expect(await ticker.boundingBox()).toEqual(TICKER_STRIP)
    await expect(ticker).toBeEmpty()

    await expectSceneScreenshot(page, 'frame.png')
})

test('the frame shows the reconnecting badge when the hot state keeps failing', async ({ page }) => {
    await page.clock.setFixedTime(STREAM_T0)
    const api = await serveStreamApi(page, { hotState: streamHotState() })
    await page.goto(`${HARNESS}?motion=0`)
    await expect(page.getByText('UTBT 2v2 World Cup 2026')).toBeVisible()

    api.failFromNowOn()
    await expect(page.getByRole('status').filter({ hasText: 'reconnecting' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('UTBT 2v2 World Cup 2026')).toBeVisible()
})
