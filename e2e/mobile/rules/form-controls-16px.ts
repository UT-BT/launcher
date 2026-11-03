import { measuredRoot, resultOf, type RuleCheck } from './types'

const TEXT_CONTROLS = [
    'input:not([type="hidden"], [type="checkbox"], [type="radio"], [type="range"], [type="button"], [type="submit"], [type="reset"], [type="file"], [type="color"], [type="image"])',
    'select',
    'textarea',
    '[contenteditable=""]',
    '[contenteditable="true"]',
].join(', ')

export const formControls16px: RuleCheck = async ({ page, surface }) => {
    const problems = await page.evaluate(({ root, selector }) => {
        const probe = window.__mobileProbe
        const small = probe.within(root, selector)
            .filter(control => probe.rendered(control))
            .map(control => ({ control, size: parseFloat(getComputedStyle(control).fontSize) }))
            .filter(({ size }) => size < 15.99)
            .map(({ control, size }) => `${probe.describe(control)} is ${Math.round(size * 10) / 10}px`)
        if (!small.length) return []
        return [`${small.length} control${small.length === 1 ? '' : 's'} below 16px`, ...probe.listed(small)]
    }, { root: measuredRoot(surface), selector: TEXT_CONTROLS })
    return resultOf(problems)
}
