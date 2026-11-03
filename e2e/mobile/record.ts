import type { Observation, RuleStatus, Verdict } from './ledger'
import type { Tier } from './manifest/types'
import type { RuleId } from './rules/ids'
import type { Engine, MobileViewport } from './viewports'

export const CRAWL_RECORD = 'mobile-crawl-record'
export const CRAWL_SHOT = 'mobile-crawl-shot'

export interface RuleOutcome {
    rule: RuleId
    status: RuleStatus | 'skipped'
    verdict: Verdict | 'skipped'
    detail: string[]
}

export interface CrawlRecord {
    surface: string
    label: string
    view: string
    tier: Tier
    path: string
    viewport: MobileViewport
    engine: Engine
    outcomes: RuleOutcome[]
}

export function observationsOf(record: CrawlRecord): Observation[] {
    return record.outcomes.flatMap(outcome => outcome.status === 'skipped'
        ? []
        : [{ rule: outcome.rule, surface: record.surface, viewport: record.viewport.id, engine: record.engine, status: outcome.status }])
}
