import { modalHeading } from './steps'
import { MODAL_ROOT, type MobileModal, type PageStep } from './types'

export const CONSENT_KEY = 'utbt:analyticsConsent:v1'

export function pageTutorial(page: 'Servers' | 'Maps' | 'Players'): MobileModal {
    const root = `[role="dialog"][aria-label="${page} page tutorial"]`
    return {
        id: 'tutorial',
        label: `${page} tutorial`,
        root,
        open: async browser => {
            await browser.getByRole('button', { name: `Restart ${page} tutorial` }).click()
            await browser.locator(root).getByRole('button', { name: 'Close tutorial' }).waitFor()
        },
    }
}

export function consentPolicy(ready: PageStep): MobileModal {
    return {
        id: 'consent-privacy-policy',
        label: 'Analytics consent › Privacy policy',
        open: async (page, data) => {
            const policyLink = page.getByRole('button', { name: 'Read the privacy policy' })
            if (await policyLink.count() === 0) {
                await page.addInitScript(key => localStorage.removeItem(key), CONSENT_KEY)
                await page.reload()
                await ready(page, data)
            }
            await policyLink.click()
            await modalHeading(page, 'Privacy Policy').waitFor()
            await page.locator(MODAL_ROOT).getByText('Controller and Contact', { exact: false }).waitFor()
        },
    }
}
