import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { FullConfig, Reporter, TestCase, TestResult } from '@playwright/test/reporter'
import { LEDGER_DIR, readLedger, regenerateLedger, writeLedger } from './ledger'
import { crawlSurfaces } from './manifest'
import { CRAWL_RECORD, CRAWL_SHOT, observationsOf, type CrawlRecord, type RuleOutcome } from './record'
import { RULE_IDS, RULES } from './rules/ids'
import { viewportOrder } from './viewports'

interface Crawled {
    record: CrawlRecord
    shot?: string
    passed: boolean
    seconds: number
}

interface Unfinished {
    title: string
    project: string
    error: string
}

const TALLIES = ['pass', 'known', 'new', 'stale', 'n/a', 'skipped'] as const
type Tally = (typeof TALLIES)[number]

function tallyOf(outcome: RuleOutcome): Tally {
    if (outcome.verdict === 'pass' && outcome.status === 'n/a') return 'n/a'
    return outcome.verdict
}

function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}

const SURFACE_ORDER = crawlSurfaces().map(surface => surface.id)

function surfaceOrder(id: string): number {
    const index = SURFACE_ORDER.indexOf(id)
    return index === -1 ? SURFACE_ORDER.length : index
}

function seconds(value: number): string {
    return `${value.toFixed(1)}s`
}

function timingsBySurface(crawled: Crawled[]): Map<string, { runs: number; total: number }> {
    const timings = new Map<string, { runs: number; total: number }>()
    for (const entry of crawled) {
        const timing = timings.get(entry.record.surface) ?? { runs: 0, total: 0 }
        timings.set(entry.record.surface, { runs: timing.runs + 1, total: timing.total + entry.seconds })
    }
    return timings
}

function shotName(record: CrawlRecord): string {
    return `${record.surface.replace(/[^a-z0-9-]+/gi, '_')}--${record.viewport.id}--${record.engine}.png`
}

const STYLE = `
body { font: 14px/1.4 system-ui, sans-serif; margin: 0; padding: 24px; background: #0b0f17; color: #e6e9ef; }
a { color: #8ab4ff; }
h1 { margin: 0 0 4px; }
h2 { margin: 32px 0 8px; border-bottom: 1px solid #263042; padding-bottom: 4px; }
table { border-collapse: collapse; margin: 8px 0; }
th, td { border: 1px solid #263042; padding: 4px 10px; text-align: right; }
th:first-child, td:first-child { text-align: left; }
nav { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 12px 0; }
.meta { color: #9aa4b5; margin: 0 0 12px; }
.grid { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
figure { margin: 0; padding: 8px; background: #121826; border: 2px solid #263042; border-radius: 8px; width: 260px; }
figure.failed { border-color: #ef4444; }
figure img { display: block; max-width: 100%; max-height: 420px; margin: 0 auto 6px; background: #000; }
figcaption strong { display: block; margin-bottom: 4px; }
ul { list-style: none; padding: 0; margin: 0; }
li { padding: 1px 6px; margin: 2px 0; border-radius: 4px; font-size: 12px; }
.pass { background: #12351f; } .known { background: #4a3a10; } .new { background: #5a1414; }
.stale { background: #3b1d5a; } .na { background: #232a36; } .skipped { background: #232a36; color: #9aa4b5; }
details { margin-top: 6px; font-size: 12px; } pre { white-space: pre-wrap; word-break: break-word; margin: 4px 0; }
`

export default class GalleryReporter implements Reporter {
    private folder = ''
    private readonly crawled = new Map<string, Crawled>()
    private readonly unfinished = new Map<string, Unfinished>()

    printsToStdio(): boolean {
        return false
    }

    onBegin(config: FullConfig) {
        this.folder = join(config.projects[0]?.outputDir ?? join(config.rootDir, 'test-results'), 'mobile-gallery')
    }

    onTestEnd(test: TestCase, result: TestResult) {
        const recordAttachment = result.attachments.find(attachment => attachment.name === CRAWL_RECORD)
        if (recordAttachment?.body) {
            const record = JSON.parse(recordAttachment.body.toString('utf8')) as CrawlRecord
            const shot = result.attachments.find(attachment => attachment.name === CRAWL_SHOT)?.path
            this.crawled.set(test.id, { record, shot, passed: result.status === 'passed', seconds: result.duration / 1000 })
            this.unfinished.delete(test.id)
            return
        }
        const project = test.parent.project()?.name ?? ''
        if (!project.startsWith('mobile-suite') || result.status === 'passed' || result.status === 'skipped') return
        this.crawled.delete(test.id)
        this.unfinished.set(test.id, {
            title: test.titlePath().slice(3).join(' › '),
            project,
            error: result.error?.message ?? result.status,
        })
    }

    onEnd() {
        if (!this.crawled.size && !this.unfinished.size) return
        const shots = join(this.folder, 'shots')
        mkdirSync(shots, { recursive: true })
        const crawled = [...this.crawled.values()]
        for (const entry of crawled) {
            if (entry.shot && existsSync(entry.shot)) copyFileSync(entry.shot, join(shots, shotName(entry.record)))
        }
        const records = crawled.map(entry => entry.record)
        const observations = records.flatMap(observationsOf)
        writeFileSync(join(this.folder, 'observations.json'), `${JSON.stringify(observations, null, 2)}\n`)
        writeFileSync(join(this.folder, 'index.html'), this.render(crawled))

        const lines = [`Mobile gallery: ${crawled.length} surface runs, ${relative(process.cwd(), join(this.folder, 'index.html'))}`]
        for (const [rule, counts] of this.tallies(records)) {
            lines.push(`  ${rule.padEnd(24)} ${TALLIES.map(tally => `${counts[tally]} ${tally}`).join(' · ')}`)
        }
        for (const [surface, timing] of [...timingsBySurface(crawled)].sort(([a], [b]) => surfaceOrder(a) - surfaceOrder(b))) {
            lines.push(`  ${surface.padEnd(24)} ${timing.runs} runs · ${seconds(timing.total)} total · ${seconds(timing.total / timing.runs)} each`)
        }
        if (this.unfinished.size) lines.push(`  ${this.unfinished.size} surface run(s) did not finish; see the gallery`)
        if (process.env.MOBILE_LEDGER === 'write') {
            writeLedger(LEDGER_DIR, regenerateLedger(readLedger(LEDGER_DIR, RULE_IDS), RULE_IDS, observations))
            lines.push(`Ledger rewritten from ${observations.length} rule results in ${relative(process.cwd(), LEDGER_DIR)}`)
        }
        process.stdout.write(`${lines.join('\n')}\n`)
    }

    private tallies(records: CrawlRecord[]): Map<string, Record<Tally, number>> {
        const counts = new Map(RULES.map(rule => [rule.id as string, Object.fromEntries(TALLIES.map(tally => [tally, 0])) as Record<Tally, number>]))
        for (const record of records) {
            for (const outcome of record.outcomes) {
                const row = counts.get(outcome.rule)
                if (row) row[tallyOf(outcome)] += 1
            }
        }
        return counts
    }

    private render(crawled: Crawled[]): string {
        const records = crawled.map(entry => entry.record)
        const surfaces = [...new Set(records.map(record => record.surface))].sort((a, b) => surfaceOrder(a) - surfaceOrder(b))
        const ruleRows = [...this.tallies(records)].map(([rule, counts]) => {
            const label = RULES.find(entry => entry.id === rule)?.label ?? rule
            return `<tr><td title="${escapeHtml(label)}">${escapeHtml(rule)}</td>${TALLIES.map(tally => `<td>${counts[tally]}</td>`).join('')}</tr>`
        }).join('')
        const unfinished = [...this.unfinished.values()].map(entry =>
            `<li class="new"><strong>${escapeHtml(entry.title)}</strong> (${escapeHtml(entry.project)})<pre>${escapeHtml(entry.error)}</pre></li>`,
        ).join('')
        const timings = timingsBySurface(crawled)
        const sections = surfaces.map(surface => {
            const runs = crawled
                .filter(entry => entry.record.surface === surface)
                .sort((a, b) => a.record.engine.localeCompare(b.record.engine) || viewportOrder(a.record.viewport.id) - viewportOrder(b.record.viewport.id))
            const first = runs[0].record
            const timing = timings.get(surface)!
            const figures = runs.map(({ record, passed, seconds: took }) => {
                const name = shotName(record)
                const alt = `${record.surface} at ${record.viewport.id} in ${record.engine}`
                const rules = record.outcomes.map(outcome => {
                    const tally = tallyOf(outcome)
                    return `<li class="${tally === 'n/a' ? 'na' : tally}" title="${escapeHtml(outcome.detail.join('\n'))}">${escapeHtml(outcome.rule)}: ${tally}</li>`
                }).join('')
                const details = record.outcomes
                    .filter(outcome => outcome.detail.length)
                    .map(outcome => `<pre><strong>${escapeHtml(outcome.rule)}</strong>\n${escapeHtml(outcome.detail.join('\n'))}</pre>`)
                    .join('')
                return `<figure class="${passed ? '' : 'failed'}"><a href="shots/${name}"><img loading="lazy" src="shots/${name}" alt="${escapeHtml(alt)}"></a>`
                    + `<figcaption><strong>${record.engine} · ${record.viewport.width}×${record.viewport.height} (${record.viewport.group}) · ${seconds(took)}</strong><ul>${rules}</ul>`
                    + `${details ? `<details><summary>Details</summary>${details}</details>` : ''}</figcaption></figure>`
            }).join('')
            return `<section id="${escapeHtml(surface)}"><h2>${escapeHtml(surface)}</h2>`
                + `<p class="meta">${escapeHtml(first.label)} · ${escapeHtml(first.path)} · view ${escapeHtml(first.view)} · ${first.tier}`
                + ` · ${timing.runs} runs, ${seconds(timing.total)} total, ${seconds(timing.total / timing.runs)} each</p>`
                + `<div class="grid">${figures}</div></section>`
        }).join('')
        return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
            + `<title>Mobile gallery</title><style>${STYLE}</style></head><body>`
            + `<h1>Mobile gallery</h1><p class="meta">${crawled.length} surface runs across ${surfaces.length} surfaces · ${new Date().toISOString()}</p>`
            + `<table><thead><tr><th>Rule</th>${TALLIES.map(tally => `<th>${tally}</th>`).join('')}</tr></thead><tbody>${ruleRows}</tbody></table>`
            + (unfinished ? `<h2>Did not finish</h2><ul>${unfinished}</ul>` : '')
            + `<nav>${surfaces.map(surface => `<a href="#${escapeHtml(surface)}">${escapeHtml(surface)}</a>`).join('')}</nav>`
            + `${sections}</body></html>\n`
    }
}
