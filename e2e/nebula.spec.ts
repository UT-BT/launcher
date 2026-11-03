import { expect, test, type Page } from '@playwright/test'
import { mockApi } from './sidebarRail'

interface NebulaMotion {
    running: number
    swirl: string
}

const STILL: NebulaMotion = { running: 0, swirl: 'none' }
const ANIMATED: NebulaMotion = { running: 2, swirl: 'block' }

function nebulaMotion(page: Page): Promise<NebulaMotion> {
    return page.locator('.nebula-bg').first().evaluate(element => ({
        running: element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length,
        swirl: getComputedStyle(element, '::before').display,
    }))
}

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
    })
    await mockApi(page)
    await page.goto('/')
})

test.describe('nebula background below lg in landscape', () => {
    test.use({ viewport: { width: 844, height: 390 } })

    test('stays still', async ({ page }) => {
        await expect.poll(() => nebulaMotion(page)).toEqual(STILL)
    })
})

test.describe('nebula background below lg in portrait', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('stays still', async ({ page }) => {
        await expect.poll(() => nebulaMotion(page)).toEqual(STILL)
    })
})

test.describe('nebula background at lg and above', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('stays still on a touch screen', async ({ page, hasTouch }) => {
        test.skip(!hasTouch, 'touch screens only')
        await expect.poll(() => nebulaMotion(page)).toEqual(STILL)
    })

    test('animates on desktop', async ({ page, hasTouch }) => {
        test.skip(hasTouch, 'desktop only')
        await expect.poll(() => nebulaMotion(page)).toEqual(ANIMATED)
    })
})
