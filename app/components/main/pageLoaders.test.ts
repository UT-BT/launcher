import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PAGE_LOADERS } from './pageLoaders'

const mainSource = readFileSync(resolve(__dirname, 'Main.tsx'), 'utf8')

/**
 * These guard a split that fails silently. `lazy()` on a page whose module Main
 * also imports a value from (a DEFAULT_*_STATE, a helper) is a no-op: the page
 * lands back in the entry chunk, nothing errors, and the only symptom is the
 * bundle budget creeping up. check:bundle catches the size; these name the cause.
 */
describe('Main.tsx page imports', () => {
    const staticImports = [...mainSource.matchAll(/^import\s+(type\s+)?([\s\S]*?)from\s+'([^']+)'/gm)]
        .map(match => ({
            isTypeOnlyStatement: Boolean(match[1]),
            clause: match[2],
            source: match[3],
        }))

    const pageImports = staticImports.filter(
        entry => /\/pages\/[A-Za-z]+Page$/.test(entry.source) || entry.source.endsWith('/pages/Home')
    )

    it('never imports a value from a lazily-loaded page module', () => {
        const offenders = pageImports
            .filter(entry => !entry.source.endsWith('/pages/Home'))
            .filter(entry => {
                if (entry.isTypeOnlyStatement) return false
                const specifiers = entry.clause.replace(/[{}]/g, '').split(',').map(s => s.trim()).filter(Boolean)
                return specifiers.some(specifier => !specifier.startsWith('type '))
            })
            .map(entry => entry.source)

        expect(offenders).toEqual([])
    })

    it('only keeps Home as an eager page import', () => {
        const eagerPages = pageImports.filter(entry => !entry.isTypeOnlyStatement).map(entry => entry.source)
        expect(eagerPages).toEqual(['@/app/components/pages/Home'])
    })

    it('has a loader for every sidebar view that is not Home', () => {
        expect(Object.keys(PAGE_LOADERS).sort()).toEqual([
            'achievements',
            'cap-it-all',
            'events',
            'maps',
            'news',
            'players',
            'servers',
            'teams',
            'world-records',
        ])
    })

    it('builds each lazy page from the shared loader so prefetch hits the same module', () => {
        for (const view of Object.keys(PAGE_LOADERS)) {
            const accessor = /^[a-z]+$/.test(view) ? `PAGE_LOADERS.${view}` : `PAGE_LOADERS['${view}']`
            expect(mainSource).toContain(`lazy(${accessor})`)
        }
    })
})
