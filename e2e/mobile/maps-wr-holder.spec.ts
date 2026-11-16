import { expect, test, type Locator, type Page } from '@playwright/test'
import { horizontalOverflow } from '../layout'
import { dataFrom } from './fixtures/data'
import { fixtureSetNamed } from './fixtures'
import { serveFixtureSet } from './fixtures/router'
import { maps } from './manifest/maps'
import { settleLayout } from './settle'

const PHONE = { width: 360, height: 780 }
const WIDE = { width: 1920, height: 1080 }

async function openMaps(page: Page) {
    await page.addInitScript(storage => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value)
    }, maps.storage ?? {})
    await serveFixtureSet(page, maps.fixtures)
    await page.goto(maps.path)
    await maps.ready(page, dataFrom(fixtureSetNamed(maps.fixtures)!))
    await settleLayout(page)
}

function card(page: Page, mapName: string): Locator {
    return page.getByRole('main').getByRole('list', { name: 'Maps' }).getByRole('listitem').filter({ hasText: mapName })
}

function row(page: Page, mapName: string): Locator {
    return page.getByRole('main').getByRole('row').filter({ hasText: mapName })
}

test.describe('Maps WR holder on phone cards', () => {
    test.use({ viewport: PHONE, contextOptions: { screen: PHONE } })

    test('a solo card shows the holder under the WR time, with the title and no split', async ({ page }) => {
        await openMaps(page)
        const solo = card(page, 'Qamariya-v2')
        await expect(solo.getByText('fierd_2', { exact: true })).toBeVisible()
        await expect(solo.getByText('Grand Champion', { exact: true })).toBeVisible()
        const wrBox = await solo.getByRole('link', { name: '00:21.521' }).boundingBox()
        const holderBox = await solo.getByText('fierd_2', { exact: true }).boundingBox()
        expect(holderBox!.y, 'the holder sits under the WR time').toBeGreaterThan(wrBox!.y + wrBox!.height - 1)
        await expect(solo.getByText(/^\d\d:\d\d\.\d{3}$/)).toHaveCount(1)
    })

    test('a team card lists every member with the split, fastest first, and the page does not overflow', async ({ page }) => {
        await openMaps(page)
        const team = card(page, 'II-Pacey-CE')
        for (const text of ['kleps', 'soupy', '00:34.887']) {
            await expect(team.getByText(text, { exact: true })).toBeVisible()
        }
        await expect(team.getByText(/^\d\d:\d\d\.\d{3}$/)).toHaveText(['00:35.071', '00:34.887', '00:35.071'])
        await expect(team.getByText(/^(kleps|soupy)$/)).toHaveText(['kleps', 'soupy'])
        await expect(team.getByText('soupy, kleps')).toHaveCount(0)
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        const cardBox = await team.boundingBox()
        for (const text of ['kleps', 'soupy', '00:34.887']) {
            const box = await team.getByText(text, { exact: true }).boundingBox()
            expect(box!.x + box!.width, `${text} stays inside its card`).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 0.5)
        }
    })

    test('tapping the WR time opens the cap for a solo record and the team cap for a team record', async ({ page }) => {
        await openMaps(page)
        await card(page, 'Qamariya-v2').getByRole('link', { name: '00:21.521' }).tap()
        await expect(page).toHaveURL(/\/caps\/[^/]+$/)
        await page.goBack()
        await card(page, 'II-Pacey-CE').getByRole('link', { name: '00:35.071' }).tap()
        await expect(page).toHaveURL(/\/team-caps\/[^/]+$/)
    })
})

test.describe('Maps WR holder in the touch table', () => {
    test.use({ viewport: WIDE, contextOptions: { screen: WIDE } })

    test('the WR cell shows the holder inline under the time, and the team lines stay inside the cell', async ({ page }) => {
        await openMaps(page)
        await expect(page.getByRole('main').getByRole('table')).toBeVisible()
        const solo = row(page, 'Qamariya-v2').getByRole('cell', { name: /00:21\.521/ })
        await expect(solo.getByText('fierd_2', { exact: true })).toBeVisible()

        const team = row(page, 'II-Pacey-CE').getByRole('cell', { name: /00:35\.071/ })
        await expect(team.getByText('kleps', { exact: true })).toBeVisible()
        await expect(team.getByText('00:34.887', { exact: true })).toBeVisible()
        await expect(team.getByText(/^(kleps|soupy)$/)).toHaveText(['kleps', 'soupy'])
        const cellBox = await team.boundingBox()
        for (const text of ['00:34.887', '00:35.071']) {
            const box = await team.getByText(text, { exact: true }).last().boundingBox()
            expect(box!.x + box!.width, `${text} stays inside the WR cell`).toBeLessThanOrEqual(cellBox!.x + cellBox!.width + 0.5)
        }
    })

    test('the WR time keeps its plain tap tooltip on touch, and a tap on the time opens the team cap', async ({ page }) => {
        await openMaps(page)
        const time = row(page, 'II-Pacey-CE').getByRole('link', { name: '00:35.071' })
        await time.evaluate(link => link.parentElement!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
        const tooltip = page.locator('body > div.fixed.w-max').filter({ hasText: 'View cap details' })
        await expect(tooltip).toBeVisible()
        await expect(tooltip).not.toContainText('kleps')
        await time.tap()
        await expect(page).toHaveURL(/\/team-caps\/[^/]+$/)
    })
})
