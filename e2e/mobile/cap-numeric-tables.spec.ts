import { expect, test, type Locator, type Page } from '@playwright/test'
import { failComparison, openCapPage, showSpeedTable, ZONES_FALLBACK } from '../capTables'
import { horizontalOverflow } from '../layout'
import { settleLayout } from './settle'

const VIEWPORTS = [
    { width: 360, height: 780 },
    { width: 780, height: 360 },
]

const FIXTURE_SETS = ['cap-detail', 'cap-detail~most-columns']

const SECTOR_COLUMNS = 4
const SPEED_COLUMNS = 4
const SPLITS_COLUMNS = 5
const SECTOR_ROWS = 10

async function cellsOutsideTheirBox(table: Locator): Promise<string[]> {
    return table.evaluate(element => {
        const problems: string[] = []
        for (const cell of element.querySelectorAll<HTMLElement>('th, td')) {
            const box = cell.getBoundingClientRect()
            const left = box.left - 0.5
            const right = box.right + 0.5
            const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT)
            const range = document.createRange()
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                if (!node.textContent?.trim()) continue
                range.selectNodeContents(node)
                for (const rect of range.getClientRects()) {
                    if (rect.width === 0) continue
                    if (rect.left < left || rect.right > right) {
                        problems.push(`"${node.textContent.trim()}" spans ${rect.left.toFixed(1)}–${rect.right.toFixed(1)}, its cell ${left.toFixed(1)}–${right.toFixed(1)}`)
                    }
                }
            }
            for (const icon of cell.querySelectorAll('svg')) {
                const rect = icon.getBoundingClientRect()
                if (rect.left < left || rect.right > right) problems.push(`an icon in "${cell.textContent?.trim()}" leaves its cell`)
            }
        }
        return problems
    })
}

async function scrollerOverflow(table: Locator): Promise<number> {
    return table.evaluate(element => {
        const scroller = element.parentElement!
        return scroller.scrollWidth - scroller.clientWidth
    })
}

async function expectEveryColumnFits(page: Page, card: Locator, columns: number, rows: number) {
    const table = card.getByRole('table')
    await expect(table.getByRole('columnheader')).toHaveCount(columns)
    await expect(table.locator('tbody tr')).toHaveCount(rows)
    await settleLayout(page)
    for (const header of await table.getByRole('columnheader').all()) await expect(header).toBeVisible()
    for (const cell of await table.locator('tbody tr').first().getByRole('cell').all()) await expect(cell).toBeVisible()
    expect(await cellsOutsideTheirBox(table)).toEqual([])
    expect(await scrollerOverflow(table)).toBeLessThanOrEqual(0)
    const box = (await table.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
}

test.beforeEach(() => {
    test.slow()
})

for (const viewport of VIEWPORTS) {
    for (const fixtures of FIXTURE_SETS) {
        test.describe(`cap numeric tables at ${viewport.width}×${viewport.height} with ${fixtures}`, () => {
            test.use({ viewport, contextOptions: { screen: viewport } })

            test('the sector table shows every column', async ({ page }) => {
                const card = await openCapPage(page, fixtures)
                await expect(card.getByText('Replay', { exact: true })).toBeVisible()
                await expectEveryColumnFits(page, card, SECTOR_COLUMNS, SECTOR_ROWS)
            })

            test('the speed table shows every column', async ({ page }) => {
                const card = await openCapPage(page, fixtures)
                await showSpeedTable(card, button => button.tap())
                await expectEveryColumnFits(page, card, SPEED_COLUMNS, SECTOR_ROWS)
            })

            test('the checkpoint split table shows every column', async ({ page }) => {
                const card = await openCapPage(page, fixtures, failComparison)
                await expect(card.getByText(ZONES_FALLBACK)).toBeVisible()
                const rows = await card.locator('tbody tr').count()
                expect(rows).toBeGreaterThan(1)
                await expectEveryColumnFits(page, card, SPLITS_COLUMNS, rows)
            })
        })
    }

    test.describe(`speed table row selection at ${viewport.width}×${viewport.height}`, () => {
        test.use({ viewport, contextOptions: { screen: viewport } })

        test('tapping a sector zooms the speed chart and tapping it again zooms out', async ({ page }) => {
            const card = await openCapPage(page, 'cap-detail')
            await showSpeedTable(card, button => button.tap())
            const sector = card.getByRole('button', { name: 'Zoom the speed chart to S3' })
            await expect(sector).toHaveAttribute('aria-pressed', 'false')

            await sector.tap()
            await expect(sector).toHaveAttribute('aria-pressed', 'true')
            await expect(card.getByRole('button', { name: 'Reset zoom', exact: true })).toBeVisible()
            await expect(card.getByText(/^Speed · S3 · vs /)).toBeVisible()

            await card.getByRole('button', { name: 'Zoom the speed chart to S7' }).tap()
            await expect(sector).toHaveAttribute('aria-pressed', 'false')
            await expect(card.getByRole('button', { name: 'Zoom the speed chart to S7' })).toHaveAttribute('aria-pressed', 'true')

            await card.getByRole('button', { name: 'Zoom the speed chart to S7' }).tap()
            await expect(card.getByRole('button', { name: 'Reset zoom', exact: true })).toHaveCount(0)
            await expect(card.getByRole('button', { name: 'Zoom the speed chart to S7' })).toHaveAttribute('aria-pressed', 'false')
        })
    })
}
