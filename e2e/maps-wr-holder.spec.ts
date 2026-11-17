import { expect, test, type Locator, type Page } from '@playwright/test'
import { dataFrom } from './mobile/fixtures/data'
import { fixtureSetNamed } from './mobile/fixtures'
import { serveFixtureSet } from './mobile/fixtures/router'
import { maps } from './mobile/manifest/maps'

const WORLD_RECORDS = /https:\/\/(api|gateway)\.utbt\.net\/v2\/world_records\/.*/
const TUTORIAL_KEY = 'utbt:mapsPageTutorial:v1'

async function openMaps(page: Page, { tutorialSeen = true }: { tutorialSeen?: boolean } = {}) {
    await page.addInitScript(({ storage, tutorialSeen, tutorialKey }) => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        for (const [key, value] of Object.entries(storage)) {
            if (key !== tutorialKey || tutorialSeen) localStorage.setItem(key, value)
        }
    }, { storage: maps.storage ?? {}, tutorialSeen, tutorialKey: TUTORIAL_KEY })
    await serveFixtureSet(page, maps.fixtures)
}

async function gotoMaps(page: Page) {
    await page.goto(maps.path)
    await maps.ready(page, dataFrom(fixtureSetNamed(maps.fixtures)!))
}

function row(page: Page, mapName: string): Locator {
    return page.getByRole('main').getByRole('row').filter({ hasText: mapName })
}

function tooltip(page: Page): Locator {
    return page.locator('body > div.fixed.w-max')
}

async function stripTeamMembers(page: Page) {
    await page.route(WORLD_RECORDS, async route => {
        const response = await route.fetch()
        const body = await response.json() as { data: { members?: unknown }[] }
        for (const record of body.data) delete record.members
        await route.fulfill({ response, json: body })
    })
}

test.describe('Maps WR holder on a pointer device', () => {
    test.skip(({ isMobile }) => isMobile, 'the holder tooltip is for pointer devices; touch shows it inline')

    test('hovering a solo WR time shows the holder, and the holder is not inline in the cell', async ({ page }) => {
        await openMaps(page)
        await gotoMaps(page)
        const time = row(page, 'Qamariya-v2').getByRole('link', { name: '00:21.521' })
        await time.hover()
        await expect(tooltip(page)).toContainText('fierd_2')
        await expect(tooltip(page)).toContainText('Grand Champion')
        await expect(tooltip(page)).not.toContainText('View cap details')
        await expect(tooltip(page).getByText(/^\d\d:\d\d\.\d{3}$/)).toHaveCount(0)
        await expect(row(page, 'Qamariya-v2').getByText('fierd_2', { exact: true })).toHaveCount(0)
    })

    test('hovering a team WR time lists every member with the split, fastest first', async ({ page }) => {
        await openMaps(page)
        await gotoMaps(page)
        await row(page, 'II-Pacey-CE').getByRole('link', { name: '00:35.071' }).hover()
        await expect(tooltip(page).getByText(/^(kleps|soupy)$/)).toHaveText(['kleps', 'soupy'])
        await expect(tooltip(page).getByText(/^\d\d:\d\d\.\d{3}$/)).toHaveText(['00:34.887', '00:35.071'])
        await expect(tooltip(page)).not.toContainText('soupy, kleps')
        await expect(tooltip(page)).not.toContainText('View cap details')
    })

    test('a team record without members falls back to "View cap details" and never shows the joined alias', async ({ page }) => {
        await openMaps(page)
        await stripTeamMembers(page)
        await gotoMaps(page)
        await row(page, 'II-Pacey-CE').getByRole('link', { name: '00:35.071' }).hover()
        await expect(tooltip(page)).toHaveText('View cap details')
        await expect(page.getByText('soupy, kleps')).toHaveCount(0)
    })

    test('while the holder is not loaded the WR time shows no holder', async ({ page }) => {
        await openMaps(page)
        await page.route(WORLD_RECORDS, () => undefined)
        await gotoMaps(page)
        const cell = row(page, 'Qamariya-v2').getByRole('cell', { name: '00:21.521' })
        await cell.getByText('00:21.521').hover()
        await expect(cell.getByText('fierd_2')).toHaveCount(0)
        await expect(tooltip(page).filter({ hasText: 'fierd_2' })).toHaveCount(0)
    })

    test('clicking the WR time opens the cap for a solo record and the team cap for a team record', async ({ page }) => {
        await openMaps(page)
        await gotoMaps(page)
        await row(page, 'Qamariya-v2').getByRole('link', { name: '00:21.521' }).click()
        await expect(page).toHaveURL(/\/caps\/[^/]+$/)
        await page.goBack()
        await row(page, 'II-Pacey-CE').getByRole('link', { name: '00:35.071' }).click()
        await expect(page).toHaveURL(/\/team-caps\/[^/]+$/)
    })

    test("the tutorial's first row shows its mock WR time and holder", async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', error => errors.push(error.message))
        await openMaps(page, { tutorialSeen: false })
        await gotoMaps(page)
        await page.getByRole('button', { name: 'Start tutorial' }).click()
        const first = page.getByRole('main').getByRole('row').nth(1)
        const time = first.getByRole('link', { name: '00:42.567' })
        await expect(time).toBeVisible()
        await time.hover()
        await expect(tooltip(page)).toContainText('TopPlayer')
        expect(errors).toEqual([])
    })
})
