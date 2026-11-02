import { expect, test, type Locator } from '@playwright/test'
import { failComparison, openCapPage, showSpeedTable, ZONES_FALLBACK } from './capTables'

const DESKTOP_WIDTHS = [1280, 1920] as const

const EXPECTED: Record<(typeof DESKTOP_WIDTHS)[number], Record<'sector' | 'speed' | 'splits', string[]>> = {
    1280: {
        sector: [
            'SECTOR at 0 width 72, header 8px 12px 12px 0.6px, cell 8px 12px, value 12px ui-monospace normal',
            'SPLIT at 72 width 134, header 8px 12px 12px 0.6px, cell 8px 12px, value 12px ui-monospace normal',
            'Δ SPLIT at 206 width 134, header 8px 12px 12px 0.6px, cell 8px 12px, value 12px ui-monospace normal',
            'Δ TOTAL at 340 width 134, header 8px 12px 12px 0.6px, cell 8px 12px, value 14px ui-monospace normal',
        ],
        speed: [
            'SECTOR at 0 width 72, header 8px 12px 12px 0.6px, cell 8px 12px, value 12px ui-monospace normal',
            'AVG SPEED at 72 width 134, header 8px 12px 12px 0.6px, cell 8px 12px, value 14px ui-monospace normal',
            'Δ SPEED at 206 width 134, header 8px 12px 12px 0.6px, cell 8px 12px, value 12px ui-monospace normal',
            'Δ LINE at 340 width 134, header 8px 12px 12px 0.6px, cell 8px 12px, value 12px ui-monospace normal',
        ],
        splits: [
            'CP at 0 width 64, header 8px 12px 12px 0.6px, cell 8px 12px, value 12px ui-monospace normal',
            'SPLIT at 64 width 103, header 8px 12px 12px 0.6px, cell 8px 12px, value 12px ui-monospace normal',
            'CUMULATIVE at 167 width 103, header 8px 12px 12px 0.6px, cell 8px 12px, value 14px ui-monospace normal',
            'Δ SPLIT at 269 width 103, header 8px 12px 12px 0.6px, cell 8px 12px, value 12px ui-monospace normal',
            'Δ TOTAL at 372 width 103, header 8px 12px 12px 0.6px, cell 8px 12px, value 12px ui-monospace normal',
        ],
    },
    1920: {
        sector: [
            'SECTOR at 0 width 72, header 8px 12px 12px 0.6px, cell 8px 12px, value 12px ui-monospace normal',
            'SPLIT at 72 width 241, header 8px 12px 12px 0.6px, cell 8px 12px, value 12px ui-monospace normal',
            'Δ SPLIT at 313 width 241, header 8px 12px 12px 0.6px, cell 8px 12px, value 12px ui-monospace normal',
            'Δ TOTAL at 553 width 241, header 8px 12px 12px 0.6px, cell 8px 12px, value 14px ui-monospace normal',
        ],
        speed: [
            'SECTOR at 0 width 72, header 8px 12px 12px 0.6px, cell 8px 12px, value 12px ui-monospace normal',
            'AVG SPEED at 72 width 241, header 8px 12px 12px 0.6px, cell 8px 12px, value 14px ui-monospace normal',
            'Δ SPEED at 313 width 241, header 8px 12px 12px 0.6px, cell 8px 12px, value 12px ui-monospace normal',
            'Δ LINE at 553 width 241, header 8px 12px 12px 0.6px, cell 8px 12px, value 12px ui-monospace normal',
        ],
        splits: [
            'CP at 0 width 64, header 8px 12px 12px 0.6px, cell 8px 12px, value 12px ui-monospace normal',
            'SPLIT at 64 width 183, header 8px 12px 12px 0.6px, cell 8px 12px, value 12px ui-monospace normal',
            'CUMULATIVE at 247 width 183, header 8px 12px 12px 0.6px, cell 8px 12px, value 14px ui-monospace normal',
            'Δ SPLIT at 429 width 183, header 8px 12px 12px 0.6px, cell 8px 12px, value 12px ui-monospace normal',
            'Δ TOTAL at 612 width 183, header 8px 12px 12px 0.6px, cell 8px 12px, value 12px ui-monospace normal',
        ],
    },
}

async function layoutOf(table: Locator): Promise<string[]> {
    await expect(table.locator('tbody tr').first()).toBeVisible()
    return table.evaluate(element => {
        const firstRow = element.querySelector('tbody tr')!
        return [...element.querySelectorAll<HTMLElement>('thead th')].map((header, index) => {
            const cell = firstRow.children[index] as HTMLElement
            const value = cell.querySelector<HTMLElement>('button, span') ?? cell
            const head = getComputedStyle(header)
            const body = getComputedStyle(cell)
            const text = getComputedStyle(value)
            const box = header.getBoundingClientRect()
            return [
                `${header.innerText} at ${Math.round(box.left - element.getBoundingClientRect().left)} width ${Math.round(box.width)}`,
                `header ${head.padding} ${head.fontSize} ${head.letterSpacing}`,
                `cell ${body.padding}`,
                `value ${text.fontSize} ${text.fontFamily.split(',')[0]} ${text.letterSpacing}`,
            ].join(', ')
        })
    })
}

for (const width of DESKTOP_WIDTHS) {
    test.describe(`cap numeric tables on desktop at ${width}px`, () => {
        test.use({ viewport: { width, height: 1080 } })

        test.beforeEach(({ isMobile }) => {
            test.skip(isMobile, 'desktop layout only')
        })

        test('the sector table keeps its desktop layout', async ({ page }) => {
            const card = await openCapPage(page, 'cap-detail')
            expect(await layoutOf(card.getByRole('table'))).toEqual(EXPECTED[width].sector)
        })

        test('the speed table keeps its desktop layout', async ({ page }) => {
            const card = await openCapPage(page, 'cap-detail')
            await showSpeedTable(card, button => button.click())
            expect(await layoutOf(card.getByRole('table'))).toEqual(EXPECTED[width].speed)
        })

        test('the checkpoint split table keeps its desktop layout', async ({ page }) => {
            const card = await openCapPage(page, 'cap-detail', failComparison)
            await expect(card.getByText(ZONES_FALLBACK)).toBeVisible()
            expect(await layoutOf(card.getByRole('table'))).toEqual(EXPECTED[width].splits)
        })
    })
}
