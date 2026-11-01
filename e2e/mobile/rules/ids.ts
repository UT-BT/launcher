export const RULES = [
    { id: 'no-horizontal-overflow', label: 'No page-level horizontal overflow' },
    { id: 'top-bar-visible', label: 'Top bar and hamburger inside the visible area (below lg)' },
    { id: 'no-error-boundary', label: 'No error boundary' },
    { id: 'axe-critical-serious', label: 'No critical or serious axe violations' },
    { id: 'form-controls-16px', label: 'Visible form controls at least 16 px' },
    { id: 'tap-targets-44px', label: 'Tap targets at least 44 px' },
] as const

export type RuleId = (typeof RULES)[number]['id']

export const RULE_IDS: readonly RuleId[] = RULES.map(rule => rule.id)
