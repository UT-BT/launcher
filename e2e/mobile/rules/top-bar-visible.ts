import { notApplicable, resultOf, type RuleCheck } from './types'

export const topBarVisible: RuleCheck = async ({ page, surface }) => {
    if (await page.evaluate(() => window.matchMedia('(min-width: 1024px)').matches)) {
        return notApplicable('from lg (1024px) up the shell shows the sidebar, not the top bar')
    }
    if (surface.modal) return notApplicable('a modal is open over the shell')
    const menu = page.getByRole('button', { name: 'Open navigation', exact: true })
    if (await menu.count() === 0) return resultOf(['there is no "Open navigation" button'])
    const problems = await menu.first().evaluate(button => {
        const probe = window.__mobileProbe
        if (!probe.rendered(button)) return ['the hamburger is not rendered']
        const area = probe.visualViewport()
        let bar: Element = button.parentElement ?? button
        for (let node = button.parentElement; node; node = node.parentElement) {
            if (['fixed', 'sticky'].includes(getComputedStyle(node).position)) {
                bar = node
                break
            }
        }
        const found: string[] = []
        const barOutside = probe.outside(bar, area)
        if (barOutside) found.push(`top bar: ${barOutside}`)
        const buttonOutside = probe.outside(button, area)
        if (buttonOutside) found.push(`hamburger: ${buttonOutside}`)
        const rect = button.getBoundingClientRect()
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
        if (!hit || !button.contains(hit)) found.push(`the hamburger is covered by ${hit ? probe.describe(hit) : 'nothing on screen'}`)
        return found
    })
    return resultOf(problems)
}
