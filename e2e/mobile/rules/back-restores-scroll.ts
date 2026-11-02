import type { Page } from '@playwright/test'
import type { CrawlSurface } from '../manifest'
import { scrollPositionProblems, scrollerTop, swipeOneViewport } from '../interactions'
import { settleLayout } from '../settle'
import { notApplicable, resultOf, type RuleCheck } from './types'

const TOLERANCE_PX = 4
const WAIT_MS = 10_000

function destinationOf(surface: CrawlSurface): string {
    return surface.entry.view === 'world-records' ? 'Home' : 'World Records'
}

async function navigateTo(page: Page, label: string) {
    const navigation = page.locator('aside#app-navigation')
    const menu = page.getByRole('button', { name: 'Open navigation', exact: true })
    if (await menu.isVisible()) await menu.tap({ timeout: WAIT_MS })
    await navigation.getByRole('link', { name: label, exact: true }).tap({ timeout: WAIT_MS })
}

async function returnedTo(page: Page, surface: CrawlSurface) {
    await surface.entry.ready(page)
    if (surface.subView?.path && surface.subView.ready) await surface.subView.ready(page)
    await settleLayout(page)
}

export const backRestoresScroll: RuleCheck = async ({ page, surface }) => {
    if (surface.modal) return notApplicable('the back rule runs on the page surface, not with a modal open')
    const [moved] = await swipeOneViewport(page)
    if (!moved) return notApplicable('nothing scrolls under a swipe at this size')
    const left = await scrollerTop(page, moved.path) ?? moved.to
    const start = page.url()
    const destination = destinationOf(surface)
    await navigateTo(page, destination)
    await page.waitForURL(url => url.href !== start, { timeout: WAIT_MS })
    await settleLayout(page)
    const problems = (await scrollPositionProblems(page)).map(problem => `a new navigation to ${destination} does not start at the top: ${problem}`)
    await page.goBack({ timeout: WAIT_MS })
    await page.waitForURL(start, { timeout: WAIT_MS })
    await returnedTo(page, surface)
    const restored = await scrollerTop(page, moved.path)
    if (restored === null) problems.push(`after Back, ${moved.scroller} is gone; it was at ${Math.round(left)}px`)
    else if (Math.abs(restored - left) > TOLERANCE_PX) problems.push(`Back leaves ${moved.scroller} at ${Math.round(restored)}px; it was at ${Math.round(left)}px before leaving`)
    return resultOf(problems)
}
