import { expect, type Page } from '@playwright/test'

export function streamPanelNav(page: Page) {
    return page.getByRole('navigation', { name: 'Stream panels' })
}

export async function openStreamPanel(page: Page, name: string) {
    const button = streamPanelNav(page).getByRole('button', { name, exact: true })
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
}
