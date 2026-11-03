import { expect, test, type Page } from '@playwright/test'
import { dataFrom } from './mobile/fixtures/data'
import { fixtureSetNamed } from './mobile/fixtures'
import { serveFixtureSet } from './mobile/fixtures/router'
import { worldRecords } from './mobile/manifest/world-records'

const RECORD_HEADERS = ['Map', 'Record Holder', 'Time', 'Difficulty', 'Date Set', 'Actions']
const RUSHER_HEADERS = ['#', 'Rusher', 'World Records', 'Share', 'Median WR', 'Average WR']

const RECORDS_BY_WIDTH: [number, string[] | 'cards'][] = [
    [1920, RECORD_HEADERS],
    [1280, RECORD_HEADERS],
    [1100, ['Map', 'Record Holder', 'Time', 'Difficulty', 'Date Set']],
    [900, ['Map', 'Record Holder', 'Time', 'Difficulty', 'Actions']],
    [700, ['Map', 'Record Holder', 'Time', 'Difficulty']],
    [600, ['Map', 'Record Holder', 'Time']],
    [500, 'cards'],
]

const RUSHERS_BY_WIDTH: [number, string[] | 'cards'][] = [
    [1920, RUSHER_HEADERS],
    [1280, ['#', 'Rusher', 'World Records', 'Median WR', 'Average WR']],
    [1100, ['#', 'Rusher', 'World Records', 'Median WR']],
    [700, ['#', 'Rusher', 'World Records']],
    [600, 'cards'],
]

async function open(page: Page) {
    await page.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    await serveFixtureSet(page, worldRecords.fixtures)
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(worldRecords.path)
    await worldRecords.ready(page, dataFrom(fixtureSetNamed(worldRecords.fixtures)!))
}

async function expectLayout(page: Page, width: number, expected: string[] | 'cards', cardsName: string) {
    await page.setViewportSize({ width, height: 1080 })
    const main = page.getByRole('main')
    if (expected === 'cards') {
        await expect(main.getByRole('list', { name: cardsName }), `cards at ${width}px`).toBeVisible()
        await expect(main.getByRole('table')).toHaveCount(0)
        return
    }
    await expect(main.getByRole('columnheader'), `headers at ${width}px`).toHaveText(expected)
}

test.describe('World Records table on desktop', () => {
    test('records keep every column at 1920 and 1280 and drop optional ones by priority below', async ({ page, isMobile }) => {
        test.skip(isMobile, 'desktop layout only')
        await open(page)
        for (const [width, expected] of RECORDS_BY_WIDTH) await expectLayout(page, width, expected, 'World records')
        await expect(page.getByRole('combobox', { name: 'Sort by' })).toBeVisible()
    })

    test('Top Rushers keeps its priority dropping', async ({ page, isMobile }) => {
        test.skip(isMobile, 'desktop layout only')
        await open(page)
        await page.getByRole('button', { name: 'Top Rushers' }).click()
        await expect(page.getByRole('main').getByRole('columnheader', { name: 'Rusher' })).toBeVisible()
        for (const [width, expected] of RUSHERS_BY_WIDTH) await expectLayout(page, width, expected, 'Top rushers')
    })

    test('the sorted header says so to assistive tech', async ({ page, isMobile }) => {
        test.skip(isMobile, 'desktop layout only')
        await open(page)
        const main = page.getByRole('main')
        await expect(main.getByRole('columnheader', { name: 'Date Set' })).toHaveAttribute('aria-sort', 'descending')
        await main.getByRole('columnheader', { name: 'Time' }).getByRole('button').click()
        await expect(main.getByRole('columnheader', { name: 'Time' })).toHaveAttribute('aria-sort', 'descending')
        await expect(main.getByRole('columnheader', { name: 'Date Set' })).not.toHaveAttribute('aria-sort', /.+/)
    })
})
