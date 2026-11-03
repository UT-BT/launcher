import { describe, expect, it } from 'vitest'
import { MOBILE_MANIFEST, crawlSurfaces, entryId } from './manifest/index'
import type { MobileModal, MobileRouteEntry } from './manifest/types'
import { renderMobileRoutesDoc } from './routes-doc'

const step = async () => {}

const tutorial: MobileModal = { id: 'tutorial', label: 'Maps tutorial', open: step }

const maps: MobileRouteEntry = {
    view: 'maps',
    tier: 'public',
    path: '/maps',
    fixtures: 'maps',
    ready: step,
    decorative: ['column 1'],
    modals: [tutorial],
    stress: { pr: 'most-columns' },
    subViews: [
        { id: 'new', label: 'New maps only', path: '/maps?new=1' },
        {
            id: 'filters',
            label: 'Filters | sort',
            open: step,
            ready: step,
            modals: [{ id: 'sort', label: 'Sort', open: step, skip: [{ rule: 'tap-targets-44px', reason: 'the native picker' }] }],
            skip: [{ rule: 'axe-critical-serious', reason: 'a third-party widget' }],
        },
    ],
}

const adminUsers: MobileRouteEntry = {
    view: 'admin',
    id: 'admin:staff',
    tier: 'role-gated',
    path: '/admin',
    fixtures: 'admin',
    ready: step,
    decorative: [],
    skip: [{ rule: 'top-bar-visible', reason: 'the admin shell hides it' }],
}

function sectionOf(doc: string, heading: string): string {
    const start = doc.indexOf(`\n## ${heading}\n`)
    expect(start, `no "## ${heading}" section`).toBeGreaterThan(-1)
    const next = doc.indexOf('\n## ', start + 1)
    return doc.slice(start, next === -1 ? undefined : next)
}

describe('the generated mobile routes doc', () => {
    const doc = renderMobileRoutesDoc([maps, adminUsers])

    it('names the command that regenerates it', () => {
        expect(doc).toContain('npm run docs:mobile-routes')
    })

    it('lists each entry in the summary table with its tier, path, fixture set and counts', () => {
        expect(doc).toContain('| `maps` | `maps` | public | `/maps` | `maps` | 2 | 2 |')
        expect(doc).toContain('| `admin:staff` | `admin` | role-gated | `/admin` | `admin` | 0 | 0 |')
    })

    it('gives each entry its own section with its tier, fixture set, stress variant and decorative columns', () => {
        const section = sectionOf(doc, 'maps')
        expect(section).toContain('- **Tier:** public')
        expect(section).toContain('- **Fixture set:** `maps`')
        expect(section).toContain('- **Stress variant (PR subset):** `most-columns`')
        expect(section).toContain('- **Decorative columns:** `column 1`')
        expect(sectionOf(doc, 'admin:staff')).toContain('- **Decorative columns:** none')
    })

    it('lists the sub-views by surface id and how each is reached', () => {
        const section = sectionOf(doc, 'maps')
        expect(section).toContain('| `maps/new` | New maps only | URL `/maps?new=1` | none |')
        expect(section).toContain('| `maps/filters` | Filters \\| sort | a step on `/maps` | none |')
    })

    it('lists the modals of the entry and of its sub-views by surface id', () => {
        const section = sectionOf(doc, 'maps')
        expect(section).toContain('| `maps/tutorial` | Maps tutorial | `maps` |')
        expect(section).toContain('| `maps/filters/sort` | Sort | `maps/filters` |')
    })

    it('lists every skipped rule with its scope and reason', () => {
        expect(sectionOf(doc, 'maps')).toContain('- `axe-critical-serious` on `maps/filters`, its modals and its stress variants: a third-party widget')
        expect(sectionOf(doc, 'maps')).toContain('- `tap-targets-44px` on `maps/filters/sort`: the native picker')
        expect(sectionOf(doc, 'admin:staff')).toContain('- `top-bar-visible` on every `admin:staff` surface: the admin shell hides it')
    })

    it('says so when an entry has no sub-views, modals or skipped rules', () => {
        const section = sectionOf(renderMobileRoutesDoc([{ ...adminUsers, skip: undefined }]), 'admin:staff')
        expect(section).toContain('No sub-views.')
        expect(section).toContain('No modals.')
        expect(section).toContain('No skipped rules.')
    })

    it('renders the same text for the same manifest', () => {
        expect(renderMobileRoutesDoc([maps, adminUsers])).toBe(doc)
    })

    it('gives every entry of the real manifest a section', () => {
        const real = renderMobileRoutesDoc(MOBILE_MANIFEST)
        for (const entry of MOBILE_MANIFEST) sectionOf(real, entryId(entry))
    })

    it('names every surface the crawl opens by the id the crawl gives it', () => {
        const real = renderMobileRoutesDoc(MOBILE_MANIFEST)
        for (const surface of crawlSurfaces('pr').filter(surface => !surface.variant)) expect(real).toContain(`\`${surface.id}\``)
    })
})
