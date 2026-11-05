import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SEASONAL_THEME_ID } from '@/app/seasonal/appearance'
import { ENTRY_IDS } from '@/app/seasonal/seasons'
import { DEFAULT_THEME_ID, LIGHT_THEME_IDS, THEMES, isLightTheme } from '@/app/theme/themes'

const html = readFileSync(resolve(__dirname, 'index.html'), 'utf8')
const script = html.match(/<script>([\s\S]*?)<\/script>/)![1]
const NOW = new Date(2026, 11, 24, 12, 0).getTime()
const DAY = 24 * 60 * 60 * 1000

function listLiteral(name: string): string[] {
    const literal = script.match(new RegExp(`var ${name} = \\[([^\\]]*)\\]`))![1]
    return [...literal.matchAll(/'([^']*)'/g)].map(match => match[1])
}

function stringLiteral(name: string): string {
    return script.match(new RegExp(`var ${name} = '([^']*)'`))![1]
}

interface PrePaintInput {
    theme?: string
    search?: string
    pathname?: string
    session?: string
    pin?: string
    cache?: { id: string | null; until: number } | string
    local?: Record<string, string>
}

function prePaint(input: PrePaintInput) {
    const attributes = new Map<string, string>()
    const classes = new Set(['dark'])
    const documentElement = {
        setAttribute: (name: string, value: string) => attributes.set(name, value),
        classList: {
            add: (name: string) => classes.add(name),
            remove: (name: string) => classes.delete(name),
        },
    }
    const local: Record<string, string> = { ...input.local }
    if (input.theme) local['utbt:theme:v1'] = JSON.stringify({ id: input.theme })
    if (input.pin) local['utbt:seasonPin:v1'] = input.pin
    if (input.cache) local['utbt:season:v2'] = typeof input.cache === 'string' ? input.cache : JSON.stringify(input.cache)
    const session: Record<string, string> = input.session ? { 'utbt:seasonOverride:v1': input.session } : {}
    const reads: string[] = []
    const storage = (entries: Record<string, string>) => ({
        getItem: (key: string) => {
            reads.push(key)
            return entries[key] ?? null
        },
    })
    const location = { pathname: input.pathname ?? '/', search: input.search ?? '' }
    new Function('document', 'localStorage', 'sessionStorage', 'location', 'Date', script)(
        { documentElement },
        storage(local),
        storage(session),
        location,
        { now: () => NOW },
    )
    return { theme: attributes.get('data-theme'), season: attributes.get('data-season'), dark: classes.has('dark'), reads }
}

const fresh = (id: string | null) => ({ id, until: NOW + DAY })
const storedLook = (id: string) => ({ theme: id === DEFAULT_THEME_ID ? undefined : id, season: undefined, dark: !isLightTheme(id) })

describe('index.html pre-paint script', () => {
    it('lists the light themes, the default theme, the Seasonal theme and the entries exactly as their registries do', () => {
        expect(listLiteral('lightThemes')).toEqual(LIGHT_THEME_IDS)
        expect(stringLiteral('defaultTheme')).toBe(DEFAULT_THEME_ID)
        expect(stringLiteral('seasonalTheme')).toBe(SEASONAL_THEME_ID)
        expect(listLiteral('entries')).toEqual(ENTRY_IDS)
    })

    it.each(THEMES.map(theme => theme.id))('paints the stored %s theme before the app mounts', id => {
        expect(prePaint({ theme: id })).toMatchObject(storedLook(id))
    })

    it.each(ENTRY_IDS)('paints a cached %s on the Seasonal theme', id => {
        expect(prePaint({ theme: 'seasonal', cache: fresh(id) })).toMatchObject({ theme: 'seasonal', season: id, dark: true })
    })

    it('paints no entry on the Seasonal theme from an expired, empty, unknown or unreadable cache', () => {
        for (const cache of [
            { id: ENTRY_IDS[0], until: NOW },
            { id: ENTRY_IDS[0], until: NOW - DAY },
            fresh(null),
            fresh('aurora'),
            fresh('none'),
            '{not json',
        ]) {
            expect(prePaint({ theme: 'seasonal', cache })).toMatchObject({ theme: 'seasonal', season: undefined, dark: true })
        }
        expect(prePaint({ theme: 'seasonal' })).toMatchObject({ theme: 'seasonal', season: undefined, dark: true })
    })

    it('takes the session preview over the pinned preview, and the pinned preview over the cache', () => {
        const [query, session, pin] = ENTRY_IDS
        const cache = fresh(query)
        expect(prePaint({ theme: 'seasonal', search: `?season=${query}`, session, pin, cache }).season).toBe(query)
        expect(prePaint({ theme: 'seasonal', session, pin, cache }).season).toBe(session)
        expect(prePaint({ theme: 'seasonal', pin, cache }).season).toBe(pin)
        expect(prePaint({ theme: 'seasonal', search: '?season=aurora', session: 'aurora', pin, cache }).season).toBe(pin)
        expect(prePaint({ theme: 'seasonal', session: 'none', pin, cache }).season).toBeUndefined()
    })

    it.each(ENTRY_IDS)('paints a %s preview as the Seasonal theme over Classic', id => {
        expect(prePaint({ search: `?season=${id}` })).toMatchObject({ theme: 'seasonal', season: id, dark: true })
        expect(prePaint({ session: id })).toMatchObject({ theme: 'seasonal', season: id, dark: true })
        expect(prePaint({ pin: id })).toMatchObject({ theme: 'seasonal', season: id, dark: true })
    })

    it.each(THEMES.map(theme => theme.id))('paints an entry preview as the dark Seasonal theme over the stored %s theme', id => {
        expect(prePaint({ theme: id, search: `?season=${ENTRY_IDS[0]}` })).toMatchObject({ theme: 'seasonal', season: ENTRY_IDS[0], dark: true })
    })

    it.each(THEMES.map(theme => theme.id))('paints nothing for a none preview and keeps the stored %s theme', id => {
        const stored = storedLook(id)
        expect(prePaint({ theme: id, search: '?season=none', cache: fresh(ENTRY_IDS[0]) })).toMatchObject(stored)
        expect(prePaint({ theme: id, session: 'none', cache: fresh(ENTRY_IDS[0]) })).toMatchObject(stored)
        expect(prePaint({ theme: id, pin: 'none', cache: fresh(ENTRY_IDS[0]) })).toMatchObject(stored)
    })

    it.each(THEMES.map(theme => theme.id).filter(id => id !== SEASONAL_THEME_ID))('gives the stored %s theme no entry whatever the cache says', id => {
        expect(prePaint({ theme: id, cache: fresh(ENTRY_IDS[0]) })).toMatchObject(storedLook(id))
    })

    it.each(['/stream/cup/42/overlay', '/events/cup/matches/7/stream'])('leaves the stream route %s without an entry or a previewed theme', pathname => {
        const preview = { search: `?season=${ENTRY_IDS[0]}`, session: ENTRY_IDS[0], pin: ENTRY_IDS[0], cache: fresh(ENTRY_IDS[0]) }
        expect(prePaint({ ...preview, pathname })).toMatchObject({ theme: undefined, season: undefined, dark: true })
        expect(prePaint({ ...preview, pathname, theme: 'red' })).toMatchObject({ theme: 'red', season: undefined })
        expect(prePaint({ ...preview, pathname, theme: 'seasonal' })).toMatchObject({ theme: 'seasonal', season: undefined })
        expect(prePaint({ ...preview, pathname, theme: 'light' })).toMatchObject({ theme: 'light', season: undefined, dark: false })
    })

    it('never reads the retired toggle or the retired cache', () => {
        const local = {
            'utbt:seasonalThemes:v1': JSON.stringify('on'),
            'utbt:season:v1': JSON.stringify(fresh(ENTRY_IDS[0])),
        }
        const painted = prePaint({ theme: 'seasonal', local })
        expect(painted.season).toBeUndefined()
        expect(painted.reads).not.toContain('utbt:seasonalThemes:v1')
        expect(painted.reads).not.toContain('utbt:season:v1')
        expect(prePaint({ theme: 'classic', search: '?season=none', local }).reads).toEqual(
            expect.not.arrayContaining(['utbt:seasonalThemes:v1', 'utbt:season:v1']),
        )
    })
})
