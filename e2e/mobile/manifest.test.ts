import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FIXTURE_SETS, fixtureSetNamed } from './fixtures'
import { STRESS_VARIANTS } from './fixtures/stress'
import { SYNTHETIC_SETS } from './fixtures/synthetic'
import { WEB_AUTH_KEY } from './fixtures/synthetic/session'
import { LEDGER_DIR, readLedger } from './ledger'
import { crawlSurfaces, entryId, MOBILE_MANIFEST } from './manifest'
import { RULE_IDS } from './rules/ids'
import { ENGINES, MOBILE_VIEWPORTS } from './viewports'

describe('mobile manifest', () => {
    it('has unique entry ids and unique surface ids', () => {
        const ids = MOBILE_MANIFEST.map(entryId)
        expect(new Set(ids).size).toBe(ids.length)
        const surfaces = crawlSurfaces().map(surface => surface.id)
        expect(new Set(surfaces).size).toBe(surfaces.length)
    })

    it('names a fixture set that exists for every entry', () => {
        for (const entry of MOBILE_MANIFEST) expect(Object.keys(FIXTURE_SETS), entryId(entry)).toContain(entry.fixtures)
        for (const surface of crawlSurfaces('full')) expect(fixtureSetNamed(surface.entry.fixtures), surface.id).toBeDefined()
    })

    it('crawls each stressed page or tab once per variant in the full matrix and once with its PR variant in the PR subset', () => {
        const stressed = MOBILE_MANIFEST.flatMap(entry => [
            ...(entry.stress ? [{ id: entryId(entry), fixtures: entry.fixtures, plan: entry.stress }] : []),
            ...(entry.subViews ?? []).flatMap(subView => subView.stress ? [{ id: `${entryId(entry)}/${subView.id}`, fixtures: entry.fixtures, plan: subView.stress }] : []),
        ])
        expect(stressed.length).toBeGreaterThan(0)
        const variantsIn = (scope: 'pr' | 'full') => crawlSurfaces(scope)
            .filter(surface => surface.variant)
            .map(surface => `${surface.id} ${surface.entry.fixtures}`)
        expect(variantsIn('full').sort()).toEqual(stressed
            .flatMap(({ id, fixtures }) => STRESS_VARIANTS.map(variant => `${id}~${variant} ${fixtures}~${variant}`)).sort())
        expect(variantsIn('pr').sort()).toEqual(stressed.map(({ id, fixtures, plan }) => `${id}~${plan.pr} ${fixtures}~${plan.pr}`).sort())
    })

    it('runs the same default surfaces in both matrices', () => {
        const defaults = (scope: 'pr' | 'full') => crawlSurfaces(scope).filter(surface => !surface.variant).map(surface => surface.id)
        expect(defaults('pr')).toEqual(defaults('full'))
    })

    it('gives every tab or sub-view reached by a tap its own ready step, so Back can tell it is shown again', () => {
        for (const entry of MOBILE_MANIFEST) {
            for (const subView of entry.subViews ?? []) {
                if (subView.open) expect(subView.ready, `${entryId(entry)}/${subView.id}`).toBeDefined()
            }
        }
    })

    it('signs every role-gated entry in and serves it a synthetic fixture set', () => {
        const synthetic = SYNTHETIC_SETS.map(set => set.name)
        for (const entry of MOBILE_MANIFEST.filter(candidate => candidate.tier === 'role-gated')) {
            expect(entry.storage?.[WEB_AUTH_KEY], `${entryId(entry)} does not sign in`).toBeDefined()
            expect(synthetic, `${entryId(entry)} serves a fixture set that is not synthetic`).toContain(entry.fixtures)
        }
    })

    it('gives every skipped rule a reason', () => {
        for (const surface of crawlSurfaces()) {
            for (const skip of surface.skip) expect(skip.reason.trim(), `${surface.id} skips ${skip.rule}`).not.toBe('')
        }
    })
})

describe('known-violations ledger', () => {
    const ledger = readLedger(LEDGER_DIR, RULE_IDS)

    it('has one file per rule and nothing else', () => {
        expect(readdirSync(LEDGER_DIR).sort()).toEqual(RULE_IDS.map(rule => `${rule}.json`).sort())
    })

    it('lists only surfaces, viewports and engines the crawl visits, for rules it runs there', () => {
        const surfaces = new Map(crawlSurfaces('full').map(surface => [surface.id, surface]))
        const viewports = MOBILE_VIEWPORTS.map(viewport => viewport.id)
        for (const rule of RULE_IDS) {
            for (const entry of ledger[rule]) {
                const where = `${rule}.json: ${JSON.stringify(entry)}`
                expect(surfaces.has(entry.surface), `${where} names no manifest surface; remove it`).toBe(true)
                expect(viewports, `${where} names no matrix viewport; remove it`).toContain(entry.viewport)
                expect(ENGINES, `${where} names no engine; remove it`).toContain(entry.engine)
                const skipped = surfaces.get(entry.surface)?.skip.some(skip => skip.rule === rule)
                expect(skipped, `${where} is for a rule the manifest skips there; remove it`).toBeFalsy()
            }
        }
    })

    it('lists each combination once', () => {
        for (const rule of RULE_IDS) {
            const keys = ledger[rule].map(entry => `${entry.surface} ${entry.viewport} ${entry.engine}`)
            expect(new Set(keys).size, `${rule}.json has duplicates`).toBe(keys.length)
        }
    })
})
