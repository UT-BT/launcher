import type { Page } from '@playwright/test'
import type { RuleStatus } from '../ledger'
import type { CrawlSurface } from '../manifest'
import { MODAL_ROOT } from '../manifest/types'
import type { Engine, MobileViewport } from '../viewports'

export interface RuleContext {
    page: Page
    surface: CrawlSurface
    viewport: MobileViewport
    engine: Engine
}

export interface RuleResult {
    status: RuleStatus
    detail: string[]
}

export type RuleCheck = (context: RuleContext) => Promise<RuleResult>

export function measuredRoot(surface: CrawlSurface): string | null {
    return surface.modal ? (surface.modal.root ?? MODAL_ROOT) : null
}

export function resultOf(problems: string[]): RuleResult {
    return { status: problems.length ? 'fail' : 'pass', detail: problems }
}

export function notApplicable(reason: string): RuleResult {
    return { status: 'n/a', detail: [reason] }
}

export function onModalRoot(check: RuleCheck): RuleCheck {
    return async context => {
        const root = measuredRoot(context.surface)
        if (root && await context.page.locator(root).count() === 0) return notApplicable(`the modal did not open: nothing matches ${root}`)
        return check(context)
    }
}
