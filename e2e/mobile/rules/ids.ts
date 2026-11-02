export const RULES = [
    { id: 'no-horizontal-overflow', label: 'No page-level horizontal overflow', changesPage: false },
    { id: 'top-bar-visible', label: 'Top bar and hamburger inside the visible area (below lg)', changesPage: false },
    { id: 'no-error-boundary', label: 'No error boundary', changesPage: false },
    { id: 'axe-critical-serious', label: 'No critical or serious axe violations', changesPage: false },
    { id: 'form-controls-16px', label: 'Visible form controls at least 16 px', changesPage: false },
    { id: 'tap-targets-44px', label: 'Tap targets at least 44 px', changesPage: false },
    { id: 'modal-fits', label: 'An opened modal fits the visible area and its close control can be tapped', changesPage: false },
    { id: 'scroll-top-after-modal', label: 'After closing a modal, scrolling to the top reaches the real top', changesPage: true },
    { id: 'back-restores-scroll', label: 'A new navigation starts at the top and Back restores the scroll position', changesPage: true },
    { id: 'rotation-recovers', label: 'After a rotation, the modal still fits and scrolling to the top reaches the real top', changesPage: true },
] as const

export type RuleId = (typeof RULES)[number]['id']

export const RULE_IDS: readonly RuleId[] = RULES.map(rule => rule.id)

export const MEASURING_RULE_IDS: readonly RuleId[] = RULES.filter(rule => !rule.changesPage).map(rule => rule.id)

export const INTERACTION_RULE_IDS: readonly RuleId[] = RULES.filter(rule => rule.changesPage).map(rule => rule.id)
