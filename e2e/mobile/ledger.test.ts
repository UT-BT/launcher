import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { judge, readLedger, regenerateLedger, writeLedger, type Ledger } from './ledger'

const ledger: Ledger = {
    'tap-targets': [{ surface: 'home', viewport: '390x844', engine: 'webkit' }],
}

describe('judging a rule result against the ledger', () => {
    it('reports a listed violation as known, so it passes', () => {
        expect(judge({ rule: 'tap-targets', surface: 'home', viewport: '390x844', engine: 'webkit', status: 'fail' }, ledger)).toBe('known')
    })

    it('fails an unlisted violation as new', () => {
        expect(judge({ rule: 'tap-targets', surface: 'home', viewport: '390x844', engine: 'chromium', status: 'fail' }, ledger)).toBe('new')
        expect(judge({ rule: 'no-error-boundary', surface: 'home', viewport: '390x844', engine: 'webkit', status: 'fail' }, ledger)).toBe('new')
    })

    it('fails a listed entry that no longer reproduces as stale', () => {
        expect(judge({ rule: 'tap-targets', surface: 'home', viewport: '390x844', engine: 'webkit', status: 'pass' }, ledger)).toBe('stale')
        expect(judge({ rule: 'tap-targets', surface: 'home', viewport: '390x844', engine: 'webkit', status: 'n/a' }, ledger)).toBe('stale')
    })

    it('passes a clean unlisted result', () => {
        expect(judge({ rule: 'tap-targets', surface: 'maps', viewport: '390x844', engine: 'webkit', status: 'pass' }, ledger)).toBe('pass')
        expect(judge({ rule: 'top-bar', surface: 'maps', viewport: '1180x820', engine: 'webkit', status: 'n/a' }, ledger)).toBe('pass')
    })
})

describe('regenerating the ledger from a run', () => {
    const before: Ledger = {
        'tap-targets': [
            { surface: 'home', viewport: '390x844', engine: 'webkit' },
            { surface: 'maps', viewport: '1180x820', engine: 'chromium' },
        ],
        'no-horizontal-overflow': [{ surface: 'cap-detail', viewport: '360x780', engine: 'chromium' }],
    }

    it('adds the run\'s failures, drops what passed and keeps what did not run', () => {
        const after = regenerateLedger(before, ['tap-targets', 'no-horizontal-overflow', 'axe'], [
            { rule: 'tap-targets', surface: 'home', viewport: '390x844', engine: 'webkit', status: 'pass' },
            { rule: 'tap-targets', surface: 'cap-detail', viewport: '360x780', engine: 'chromium', status: 'fail' },
            { rule: 'no-horizontal-overflow', surface: 'cap-detail', viewport: '360x780', engine: 'chromium', status: 'fail' },
            { rule: 'axe', surface: 'home', viewport: '390x844', engine: 'webkit', status: 'fail' },
        ])
        expect(after).toEqual({
            'tap-targets': [
                { surface: 'cap-detail', viewport: '360x780', engine: 'chromium' },
                { surface: 'maps', viewport: '1180x820', engine: 'chromium' },
            ],
            'no-horizontal-overflow': [{ surface: 'cap-detail', viewport: '360x780', engine: 'chromium' }],
            axe: [{ surface: 'home', viewport: '390x844', engine: 'webkit' }],
        })
    })

    it('drops an entry whose rule no longer applies at that size', () => {
        const after = regenerateLedger(before, ['tap-targets', 'no-horizontal-overflow'], [
            { rule: 'tap-targets', surface: 'maps', viewport: '1180x820', engine: 'chromium', status: 'n/a' },
        ])
        expect(after['tap-targets']).toEqual([{ surface: 'home', viewport: '390x844', engine: 'webkit' }])
    })

    it('orders entries by surface, engine and matrix position so reruns give the same files', () => {
        const after = regenerateLedger({}, ['axe'], [
            { rule: 'axe', surface: 'maps', viewport: '1180x820', engine: 'webkit', status: 'fail' },
            { rule: 'axe', surface: 'maps', viewport: '360x780', engine: 'webkit', status: 'fail' },
            { rule: 'axe', surface: 'home', viewport: '844x390', engine: 'webkit', status: 'fail' },
            { rule: 'axe', surface: 'home', viewport: '390x844', engine: 'chromium', status: 'fail' },
            { rule: 'axe', surface: 'home', viewport: '390x844', engine: 'webkit', status: 'fail' },
        ])
        expect(after.axe.map(entry => `${entry.surface} ${entry.engine} ${entry.viewport}`)).toEqual([
            'home chromium 390x844',
            'home webkit 390x844',
            'home webkit 844x390',
            'maps webkit 360x780',
            'maps webkit 1180x820',
        ])
    })
})

describe('ledger files', () => {
    let folder = ''
    beforeEach(() => { folder = mkdtempSync(join(tmpdir(), 'mobile-ledger-')) })
    afterEach(() => rmSync(folder, { recursive: true, force: true }))

    it('writes one file per rule with one entry per line, and reads them back', () => {
        const ledger: Ledger = {
            'tap-targets': [
                { surface: 'home', viewport: '390x844', engine: 'webkit' },
                { surface: 'maps', viewport: '360x780', engine: 'chromium' },
            ],
            axe: [],
        }
        writeLedger(folder, ledger)
        expect(readFileSync(join(folder, 'tap-targets.json'), 'utf8')).toBe(
            '[\n' +
            '  { "surface": "home", "viewport": "390x844", "engine": "webkit" },\n' +
            '  { "surface": "maps", "viewport": "360x780", "engine": "chromium" }\n' +
            ']\n',
        )
        expect(readFileSync(join(folder, 'axe.json'), 'utf8')).toBe('[]\n')
        expect(readLedger(folder, ['tap-targets', 'axe'])).toEqual(ledger)
    })

    it('reads a rule with no file yet as an empty list', () => {
        expect(readLedger(folder, ['form-controls'])).toEqual({ 'form-controls': [] })
    })
})
