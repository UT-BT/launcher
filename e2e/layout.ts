import type { Page } from '@playwright/test'

export async function horizontalOverflow(page: Page): Promise<number> {
    return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}
