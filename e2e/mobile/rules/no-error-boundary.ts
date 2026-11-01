import type { Locator, Page } from '@playwright/test'
import { resultOf, type RuleCheck } from './types'

function boundaryHeading(page: Page): Locator {
    return page.getByRole('heading', { name: 'Something went wrong' })
}

function devServerOverlay(page: Page): Locator {
    return page.locator('vite-error-overlay')
}

export function errorScreen(page: Page): Locator {
    return boundaryHeading(page).or(devServerOverlay(page)).first()
}

export const noErrorBoundary: RuleCheck = async ({ page }) => {
    const problems: string[] = []
    if (await boundaryHeading(page).count()) problems.push('the error boundary shows "Something went wrong"')
    if (await devServerOverlay(page).count()) problems.push('the dev server error overlay is showing')
    return resultOf(problems)
}
