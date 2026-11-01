import { expect, test, type Page } from '@playwright/test'
import { reopenOnDroppedModule } from './dev-server'
import { serveFixtureSet } from './fixtures/router'
import { judge, LEDGER_DIR, readLedger, type LedgerKey } from './ledger'
import { crawlSurfaces, surfaceSteps, type CrawlSurface } from './manifest'
import { CRAWL_RECORD, CRAWL_SHOT, type CrawlRecord, type RuleOutcome } from './record'
import { RULE_CHECKS } from './rules'
import { RULE_IDS, type RuleId } from './rules/ids'
import { errorScreen } from './rules/no-error-boundary'
import { installProbe } from './rules/probe'
import type { RuleContext } from './rules/types'
import { settleLayout } from './settle'
import { crawlViewports, matrixScope, type Engine } from './viewports'

const SCOPE = matrixScope(process.env.MOBILE_MATRIX)
const WRITING_LEDGER = process.env.MOBILE_LEDGER === 'write'
const LEDGER = readLedger(LEDGER_DIR, RULE_IDS)
const CRASHED = Symbol('error screen')

function engineTags(engines: Engine[]): string[] {
    return engines.length === 1 ? [`@${engines[0]}-only`] : []
}

async function openSurface(page: Page, surface: CrawlSurface) {
    const storage = { 'utbt:analyticsConsent:v1': 'denied', ...surface.entry.storage }
    await page.addInitScript(entries => {
        for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value)
    }, storage)
    await serveFixtureSet(page, surface.entry.fixtures)
    const { path, steps } = surfaceSteps(surface)
    await reopenOnDroppedModule(page, async abandoned => {
        await page.goto(path)
        const crashed = errorScreen(page).waitFor({ state: 'attached' }).then(() => CRASHED)
        crashed.catch(() => undefined)
        for (const step of steps) {
            if (abandoned.aborted) return
            if (await Promise.race([step(page), crashed]) === CRASHED) return
        }
    })
}

function ledgerKey(context: RuleContext): LedgerKey {
    return { surface: context.surface.id, viewport: context.viewport.id, engine: context.engine }
}

function failureMessage(context: RuleContext, outcome: RuleOutcome): string {
    const where = `${context.surface.id} at ${context.viewport.id} in ${context.engine}`
    const file = `e2e/mobile/ledger/${outcome.rule}.json`
    if (outcome.verdict === 'stale') {
        const entry = JSON.stringify(ledgerKey(context))
        return `${outcome.rule} no longer fails on ${where}: remove this entry from ${file}: ${entry}`
    }
    return [
        `${outcome.rule} fails on ${where}, and ${file} does not list it:`,
        ...outcome.detail.map(line => `  ${line}`),
        'Fix it. Only a failure that predates your change belongs in the ledger (agents/testing.md, Mobile suite).',
    ].join('\n')
}

async function runRule(context: RuleContext, rule: RuleId): Promise<RuleOutcome> {
    const skip = context.surface.skip.find(entry => entry.rule === rule)
    if (skip) return { rule, status: 'skipped', verdict: 'skipped', detail: [skip.reason] }
    const result = await RULE_CHECKS[rule](context)
    const verdict = judge({ rule, ...ledgerKey(context), status: result.status }, LEDGER)
    return { rule, status: result.status, verdict, detail: result.detail }
}

test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.message))
})

for (const viewport of crawlViewports(SCOPE)) {
    test.describe(viewport.id, () => {
        test.use({
            viewport: { width: viewport.width, height: viewport.height },
            contextOptions: { screen: { width: viewport.width, height: viewport.height } },
        })

        for (const surface of crawlSurfaces()) {
            test(surface.id, { tag: engineTags(viewport.engines) }, async ({ page, browserName }, testInfo) => {
                const context: RuleContext = { page, surface, viewport, engine: browserName as Engine }
                await openSurface(page, surface)
                await settleLayout(page)
                await installProbe(page)

                const outcomes: RuleOutcome[] = []
                for (const rule of RULE_IDS) {
                    await test.step(rule, async () => {
                        const outcome = await runRule(context, rule)
                        outcomes.push(outcome)
                        if (WRITING_LEDGER) return
                        if (outcome.verdict === 'new') expect.soft(outcome.status, failureMessage(context, outcome)).toBe('pass')
                        if (outcome.verdict === 'stale') expect.soft(outcome.status, failureMessage(context, outcome)).toBe('fail')
                    })
                }

                const shot = testInfo.outputPath('surface.png')
                await page.screenshot({ path: shot, animations: 'disabled', caret: 'hide', scale: 'css' })
                await testInfo.attach(CRAWL_SHOT, { path: shot, contentType: 'image/png' })

                const record: CrawlRecord = {
                    surface: surface.id,
                    label: surface.label,
                    view: surface.entry.view,
                    tier: surface.entry.tier,
                    path: surfaceSteps(surface).path,
                    viewport,
                    engine: context.engine,
                    outcomes,
                }
                await testInfo.attach(CRAWL_RECORD, { body: JSON.stringify(record), contentType: 'application/json' })
            })
        }
    })
}
