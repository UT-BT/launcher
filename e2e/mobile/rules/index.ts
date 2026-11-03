import { axeCriticalSerious } from './axe-critical-serious'
import { backRestoresScroll } from './back-restores-scroll'
import { cardsExposeEveryColumn } from './cards-expose-every-column'
import { formControls16px } from './form-controls-16px'
import type { RuleId } from './ids'
import { interactive } from './interactive'
import { modalFits } from './modal-fits'
import { noErrorBoundary } from './no-error-boundary'
import { noHorizontalOverflow } from './no-horizontal-overflow'
import { rotationRecovers } from './rotation-recovers'
import { scrollTopAfterModal } from './scroll-top-after-modal'
import { tableShowsEveryColumn } from './table-shows-every-column'
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
    'modal-fits': onModalRoot(modalFits),
    'table-shows-every-column': interactive(onModalRoot(tableShowsEveryColumn)),
    'cards-expose-every-column': interactive(onModalRoot(cardsExposeEveryColumn)),
    'scroll-top-after-modal': interactive(onModalRoot(scrollTopAfterModal)),
    'back-restores-scroll': interactive(backRestoresScroll),
    'rotation-recovers': interactive(rotationRecovers),
}
