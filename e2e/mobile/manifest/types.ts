import type { Page } from '@playwright/test'
import type { RuleId } from '../rules/ids'

export type Tier = 'public' | 'role-gated'

export type PageStep = (page: Page) => Promise<void>

export interface RuleSkip {
    rule: RuleId
    reason: string
}

export const MODAL_ROOT = '[data-modal-backdrop]'

export interface MobileModal {
    id: string
    label: string
    open: PageStep
    root?: string
    skip?: RuleSkip[]
}

type Reach = { path: string; open?: never } | { open: PageStep; path?: never }

export type MobileSubView = Reach & {
    id: string
    label: string
    ready?: PageStep
    modals?: MobileModal[]
    skip?: RuleSkip[]
}

export interface MobileRouteEntry {
    view: string
    tier: Tier
    path: string
    fixtures: string
    ready: PageStep
    storage?: Record<string, string>
    subViews?: MobileSubView[]
    modals?: MobileModal[]
    skip?: RuleSkip[]
}
