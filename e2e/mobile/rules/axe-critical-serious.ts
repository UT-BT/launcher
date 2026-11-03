import AxeBuilder from '@axe-core/playwright'
import { measuredRoot, resultOf, type RuleCheck } from './types'

export const axeCriticalSerious: RuleCheck = async ({ page, surface }) => {
    const root = measuredRoot(surface)
    const builder = new AxeBuilder({ page })
    const results = await (root ? builder.include(root) : builder)
        .withTags(['wcag2a', 'wcag2aa'])
        .disableRules(['color-contrast'])
        .analyze()
    const problems = results.violations
        .filter(violation => violation.impact === 'critical' || violation.impact === 'serious')
        .map(violation => {
            const count = violation.nodes.length
            const targets = violation.nodes.slice(0, 3).map(node => node.target.join(' ')).join(', ')
            return `${violation.id} (${violation.impact}, ${count} element${count === 1 ? '' : 's'}): ${targets}`
        })
    return resultOf(problems)
}
