import type { Page } from '@playwright/test'
import type { FixtureData } from '../fixtures/data'
import type { StressVariant } from '../fixtures/stress'
import type { RuleId } from '../rules/ids'

export type Tier = 'public' | 'role-gated'

export type PageStep = (page: Page, data?: FixtureData) => Promise<void>

export type BoundStep = (page: Page) => Promise<void>

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

export interface StressPlan {
    pr: StressVariant
}

type Reach = { path: string; open?: never } | { open: PageStep; path?: never }

export type MobileSubView = Reach & {
    id: string
    label: string
    ready?: PageStep
    modals?: MobileModal[]
    stress?: StressPlan
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
    stress?: StressPlan
    skip?: RuleSkip[]
}
