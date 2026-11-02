import { expect, test, type Page } from '@playwright/test'
import { ELIM_PATH, ELIM_ROUNDS, serveEliminationBracket } from './eliminationBracket'
import { horizontalOverflow } from './layout'
import { serveFixtureSet } from './mobile/fixtures/router'
import { eventDetail } from './mobile/manifest/event-detail'

const DESKTOP_WIDTHS = [1280, 1920]

interface Layout {
    headers: { text: string; left: number; top: number; width: number }[]
    rounds: { left: number; top: number; width: number }[]
    scrollable: number
    scrollAfterNudge: number
}

async function openBracket(page: Page) {
    await page.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    await serveFixtureSet(page, eventDetail.fixtures)
    await serveEliminationBracket(page)
    await page.goto(ELIM_PATH)
    await eventDetail.ready(page)
    await expect(page.getByRole('heading', { name: ELIM_ROUNDS[0] })).toBeVisible()
}

async function bracketLayout(page: Page): Promise<Layout> {
    return page.evaluate((labels: string[]) => {
        const headers = [...document.querySelectorAll('main h3')]
            .filter(header => labels.includes(header.textContent ?? '') && header.getClientRects().length > 0)
        const round = headers[0]?.parentElement
        const scroller = round?.parentElement?.parentElement
        if (!round?.parentElement || !scroller) throw new Error('no bracket rounds on the page')
        const box = (element: Element) => {
            const rect = element.getBoundingClientRect()
            return { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width) }
        }
        const scrollable = scroller.scrollWidth - scroller.clientWidth
        scroller.scrollLeft = Math.min(37, scrollable)
        const scrollAfterNudge = scroller.scrollLeft
        scroller.scrollLeft = 0
        return {
            headers: headers.map(header => ({ text: header.textContent ?? '', ...box(header) })),
            rounds: [...round.parentElement.children].map(box),
            scrollable,
            scrollAfterNudge,
        }
    }, [...ELIM_ROUNDS])
}

for (const width of DESKTOP_WIDTHS) {
    test.describe(`elimination bracket at ${width}px`, () => {
        test.use({ viewport: { width, height: 1080 }, timezoneId: 'UTC' })

        test.beforeEach(({ isMobile }) => {
            test.skip(isMobile, 'desktop layout only')
        })

        test('heads each round in its own column, in one row, with free sideways scrolling', async ({ page }) => {
            await openBracket(page)
            const layout = await bracketLayout(page)

            expect(layout.headers.map(header => header.text)).toEqual([...ELIM_ROUNDS])
            expect(new Set(layout.headers.map(header => header.top)).size, 'headers share one row').toBe(1)
            expect(layout.headers.map(header => header.left)).toEqual(layout.rounds.map(round => round.left))
            expect(layout.headers.map(header => header.width)).toEqual(layout.rounds.map(round => round.width))
            expect(layout.scrollAfterNudge, 'a sideways nudge stays where it lands').toBe(Math.min(37, layout.scrollable))
            expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        })
    })
}
