import type { Page } from '@playwright/test'

const STABLE_FRAMES = 3

export async function settleLayout(page: Page) {
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    await page.waitForFunction(stableFrames => {
        const finite = (animation: Animation) => Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))
        if (document.getAnimations().some(animation => animation.playState === 'running' && finite(animation))) return false
        const onScreen = [...document.images].filter(image => {
            const rect = image.getBoundingClientRect()
            return rect.width > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth
        })
        if (onScreen.some(image => !image.complete)) return false
        const main = document.querySelector('main')
        const signature = [
            document.documentElement.scrollWidth,
            document.documentElement.scrollHeight,
            main?.scrollWidth,
            main?.scrollHeight,
            document.getElementsByTagName('*').length,
        ].join()
        const state = window as unknown as { __mobileSettle?: { signature: string; frames: number } }
        if (state.__mobileSettle?.signature === signature) state.__mobileSettle.frames += 1
        else state.__mobileSettle = { signature, frames: 0 }
        return state.__mobileSettle.frames >= stableFrames
    }, STABLE_FRAMES, { polling: 'raf' })
}
