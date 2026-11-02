import { expect, test, type Page } from '@playwright/test'
import { ELIM_FIRST_TEAM, ELIM_PATH, ELIM_ROUNDS, serveEliminationBracket } from '../eliminationBracket'
import { reopenOnDroppedModule } from './dev-server'
import { serveFixtureSet } from './fixtures/router'
import { swipeScroll } from './interactions'
import { eventDetail } from './manifest/event-detail'
import { installProbe } from './rules/probe'
import { settleLayout } from './settle'

interface RoundEdges {
    scrollerLeft: number
    scrollLeft: number
    roundWidth: number
    roundLefts: number[]
}

async function openBracket(page: Page) {
    await page.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    await serveFixtureSet(page, eventDetail.fixtures)
    await serveEliminationBracket(page)
    await reopenOnDroppedModule(page, async () => {
        await page.goto(ELIM_PATH)
        await eventDetail.ready(page)
        await expect(page.getByRole('heading', { name: ELIM_ROUNDS[0] })).toBeVisible()
    })
    await settleLayout(page)
    await installProbe(page)
}

async function roundEdges(page: Page, nudge = 0): Promise<RoundEdges> {
    return page.evaluate(({ team, nudge }) => {
        const main = document.querySelector('main')
        const scroller = [...(main?.querySelectorAll('*') ?? [])].find(element => {
            const overflow = getComputedStyle(element).overflowX
            return (overflow === 'auto' || overflow === 'scroll') && element.scrollWidth > element.clientWidth && element.textContent?.includes(team)
        })
        if (!scroller?.firstElementChild) throw new Error('no sideways-scrolling bracket on the page')
        if (nudge) scroller.scrollBy({ left: nudge, behavior: 'instant' })
        const rounds = [...scroller.firstElementChild.children]
        return {
            scrollerLeft: scroller.getBoundingClientRect().left + scroller.clientLeft,
            scrollLeft: scroller.scrollLeft,
            roundWidth: rounds[0].getBoundingClientRect().width,
            roundLefts: rounds.map(round => round.getBoundingClientRect().left),
        }
    }, { team: ELIM_FIRST_TEAM, nudge })
}

async function swipeSideways(page: Page, deltaX: number) {
    let last = (await roundEdges(page, deltaX)).scrollLeft
    await settleLayout(page)
    await expect.poll(async () => {
        const now = (await roundEdges(page)).scrollLeft
        const settled = now === last
        last = now
        return settled
    }, { intervals: [100] }).toBe(true)
}

function alignedRound(edges: RoundEdges): number {
    return edges.roundLefts.findIndex(left => Math.abs(left - edges.scrollerLeft) <= 1)
}

async function topBarBottom(page: Page): Promise<number> {
    return page.getByRole('button', { name: 'Open navigation' }).evaluate(button => {
        let bar: Element = button
        while (bar.parentElement && getComputedStyle(bar).position !== 'fixed') bar = bar.parentElement
        return bar.getBoundingClientRect().bottom
    })
}

test.describe('elimination bracket on a phone', () => {
    test('a sideways swipe settles with the next round\'s left edge on the container\'s left edge', async ({ page }) => {
        await openBracket(page)
        const start = await roundEdges(page)
        expect(alignedRound(start), 'the first round starts on the left edge').toBe(0)

        await swipeSideways(page, Math.round(start.roundWidth * 0.6))

        const settled = await roundEdges(page)
        expect(alignedRound(settled), `round left edges ${settled.roundLefts.map(Math.round).join(', ')} against the container at ${Math.round(settled.scrollerLeft)}`).toBe(1)
    })

    test('round headers stay visible below the top bar after scrolling down, over their rounds', async ({ page }) => {
        await openBracket(page)
        const start = await roundEdges(page)
        await swipeSideways(page, Math.round(start.roundWidth * 0.6))

        const header = page.getByRole('heading', { name: ELIM_ROUNDS[1] })
        const barBottom = await topBarBottom(page)
        const headerTops: number[] = []
        for (const delta of [600, 300]) {
            const moves = await swipeScroll(page, delta, 'page')
            await settleLayout(page)
            expect(moves.length, `a ${delta}px swipe scrolls the page down`).toBeGreaterThan(0)
            const box = await header.boundingBox()
            if (!box) throw new Error('the round header has no box')
            const placement = `the header top ${Math.round(box.y)} sits just below the top bar's bottom ${Math.round(barBottom)}`
            expect(box.y - barBottom, placement).toBeGreaterThanOrEqual(-1)
            expect(box.y - barBottom, placement).toBeLessThanOrEqual(16)
            headerTops.push(Math.round(box.y))
        }
        expect(headerTops[1], 'the header stays put while the page keeps scrolling').toBe(headerTops[0])

        const box = await header.boundingBox()
        if (!box) throw new Error('the round header has no box')
        const edges = await roundEdges(page)
        expect(Math.abs(box.x - edges.roundLefts[1]), 'the header sits over its round').toBeLessThanOrEqual(1)
        const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.textContent ?? null, { x: box.x + 4, y: box.y + box.height / 2 })
        expect(hit, 'nothing covers the header').toBe(ELIM_ROUNDS[1])
    })
})
