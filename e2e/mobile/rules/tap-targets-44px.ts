import { measuredRoot, resultOf, type RuleCheck } from './types'

const TARGETS = [
    'a[href]',
    'button',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    'summary',
    '[role="button"]',
    '[role="link"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="switch"]',
].join(', ')

const MIN_SIZE = 44

export const tapTargets44px: RuleCheck = async ({ page, surface }) => {
    const problems = await page.evaluate(({ root, selector, min }) => {
        const probe = window.__mobileProbe
        const inSentence = (element: Element) => element.tagName === 'A'
            && getComputedStyle(element).display === 'inline'
            && (element.parentElement?.textContent?.trim().length ?? 0) > (element.textContent?.trim().length ?? 0)
        const targets = new Set<Element>()
        for (const element of probe.within(root, selector)) {
            if (element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true' || inSentence(element)) continue
            const toggleLabel = element.matches('input[type="checkbox"], input[type="radio"]') ? (element as HTMLInputElement).labels?.[0] ?? null : null
            targets.add(toggleLabel ?? element)
        }
        const small = [...targets]
            .filter(target => probe.rendered(target))
            .map(target => ({ target, rect: target.getBoundingClientRect() }))
            .filter(({ rect }) => rect.width < min - 0.5 || rect.height < min - 0.5)
            .map(({ target, rect }) => `${probe.describe(target)} is ${Math.round(rect.width)}×${Math.round(rect.height)}`)
        if (!small.length) return []
        return [`${small.length} target${small.length === 1 ? '' : 's'} below ${min}×${min}px`, ...probe.listed(small)]
    }, { root: measuredRoot(surface), selector: TARGETS, min: MIN_SIZE })
    return resultOf(problems)
}
