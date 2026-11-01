import { axeCriticalSerious } from './axe-critical-serious'
import { formControls16px } from './form-controls-16px'
import type { RuleId } from './ids'
import { noErrorBoundary } from './no-error-boundary'
import { noHorizontalOverflow } from './no-horizontal-overflow'
import { tapTargets44px } from './tap-targets-44px'
import { topBarVisible } from './top-bar-visible'
import { onModalRoot, type RuleCheck } from './types'

export const RULE_CHECKS: Readonly<Record<RuleId, RuleCheck>> = {
    'no-horizontal-overflow': noHorizontalOverflow,
    'top-bar-visible': topBarVisible,
    'no-error-boundary': noErrorBoundary,
    'axe-critical-serious': onModalRoot(axeCriticalSerious),
    'form-controls-16px': onModalRoot(formControls16px),
    'tap-targets-44px': onModalRoot(tapTargets44px),
}
