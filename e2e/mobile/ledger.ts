import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { viewportOrder, type Engine } from './viewports'

export const LEDGER_DIR = join(__dirname, 'ledger')

export interface LedgerKey {
    surface: string
    viewport: string
    engine: Engine
}

export type Ledger = Record<string, LedgerKey[]>

export type RuleStatus = 'pass' | 'fail' | 'n/a'

export interface Observation extends LedgerKey {
    rule: string
    status: RuleStatus
}

export type Verdict = 'pass' | 'known' | 'new' | 'stale'

function sameKey(a: LedgerKey, b: LedgerKey): boolean {
    return a.surface === b.surface && a.viewport === b.viewport && a.engine === b.engine
}

function isListed(observation: Observation, ledger: Ledger): boolean {
    return (ledger[observation.rule] ?? []).some(entry => sameKey(entry, observation))
}

export function judge(observation: Observation, ledger: Ledger): Verdict {
    const listed = isListed(observation, ledger)
    if (observation.status === 'fail') return listed ? 'known' : 'new'
    return listed ? 'stale' : 'pass'
}

function byText(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0
}

function compareKeys(a: LedgerKey, b: LedgerKey): number {
    return byText(a.surface, b.surface)
        || byText(a.engine, b.engine)
        || viewportOrder(a.viewport) - viewportOrder(b.viewport)
        || byText(a.viewport, b.viewport)
}

export function regenerateLedger(ledger: Ledger, rules: readonly string[], observations: readonly Observation[]): Ledger {
    const next: Ledger = {}
    for (const rule of rules) {
        const ran = observations.filter(observation => observation.rule === rule)
        const kept = (ledger[rule] ?? []).filter(entry => !ran.some(observation => sameKey(observation, entry)))
        const failed = ran
            .filter(observation => observation.status === 'fail')
            .map(({ surface, viewport, engine }) => ({ surface, viewport, engine }))
        const unique = [...kept, ...failed].filter((entry, index, all) => all.findIndex(other => sameKey(other, entry)) === index)
        next[rule] = unique.sort(compareKeys)
    }
    return next
}

function ledgerFile(folder: string, rule: string): string {
    return join(folder, `${rule}.json`)
}

export function readLedger(folder: string, rules: readonly string[]): Ledger {
    const ledger: Ledger = {}
    for (const rule of rules) {
        const file = ledgerFile(folder, rule)
        ledger[rule] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as LedgerKey[] : []
    }
    return ledger
}

function serializeEntry({ surface, viewport, engine }: LedgerKey): string {
    const fields = Object.entries({ surface, viewport, engine }).map(([name, value]) => `${JSON.stringify(name)}: ${JSON.stringify(value)}`)
    return `  { ${fields.join(', ')} }`
}

function serializeEntries(entries: readonly LedgerKey[]): string {
    if (!entries.length) return '[]\n'
    return `[\n${entries.map(serializeEntry).join(',\n')}\n]\n`
}

export function writeLedger(folder: string, ledger: Ledger): void {
    mkdirSync(folder, { recursive: true })
    for (const [rule, entries] of Object.entries(ledger)) writeFileSync(ledgerFile(folder, rule), serializeEntries(entries))
}
