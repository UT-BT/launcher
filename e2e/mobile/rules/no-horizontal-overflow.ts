import { resultOf, type RuleCheck } from './types'

export const noHorizontalOverflow: RuleCheck = async ({ page }) => {
    const problems = await page.evaluate(() => {
        const probe = window.__mobileProbe
        const area = probe.visualViewport()
        const found: string[] = []
        const root = document.scrollingElement ?? document.documentElement
        const scrollers = [...new Set([root, document.body, ...document.querySelectorAll('main')])]
        for (const scroller of scrollers) {
            const extra = Math.round(scroller.scrollWidth - scroller.clientWidth)
            if (extra > 1) found.push(`${scroller === root ? 'the page' : scroller.tagName.toLowerCase()} scrolls ${extra}px sideways`)
        }
        const width = document.documentElement.scrollWidth
        if (width - area.width > 1) found.push(`the document is ${Math.round(width)}px wide in a ${Math.round(area.width)}px visual viewport`)
        if (Math.abs(area.scale - 1) > 0.01) found.push(`the visual viewport is zoomed to ${area.scale.toFixed(2)}`)
        return found
    })
    return resultOf(problems)
}
