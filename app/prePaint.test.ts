import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SEASONAL_THEME_ID } from '@/app/seasonal/appearance'
import { SOUTHERN_ZONES, type Hemisphere } from '@/app/seasonal/hemisphere'
import { ENTRIES, ENTRY_IDS, type Entry, type EntryId } from '@/app/seasonal/seasons'
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
    hemisphere?: string
    hemispherePreview?: string
    timeZone?: string | null
    now?: number
    local?: Record<string, string>
}

function pinnedDate(now: number) {
    return class extends Date {
        constructor() {
            super(now)
        }

        static now() {
            return now
        }
    }
}

function deviceZone(timeZone: string | null) {
    return {
        DateTimeFormat: () => ({
            resolvedOptions: () => {
                if (timeZone === null) throw new RangeError('no time zone')
                return { timeZone }
            },
        }),
    }
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
    if (input.hemisphere) local['utbt:hemisphere:v1'] = input.hemisphere
    const session: Record<string, string> = {}
    if (input.session) session['utbt:seasonOverride:v1'] = input.session
    if (input.hemispherePreview) session['utbt:hemisphereOverride:v1'] = input.hemispherePreview
    const reads: string[] = []
    const storage = (entries: Record<string, string>) => ({
        getItem: (key: string) => {
            reads.push(key)
            return entries[key] ?? null
        },
    })
    const location = { pathname: input.pathname ?? '/', search: input.search ?? '' }
    new Function('document', 'localStorage', 'sessionStorage', 'location', 'Date', 'Intl', script)(
        { documentElement },
        storage(local),
        storage(session),
        location,
        pinnedDate(input.now ?? NOW),
        deviceZone(input.timeZone === undefined ? 'Europe/London' : input.timeZone),
    )
    return { theme: attributes.get('data-theme'), season: attributes.get('data-season'), dark: classes.has('dark'), reads }
}

const fresh = (id: string | null) => ({ id, until: NOW + DAY })
const at = (year: number, month: number, day: number, hour = 12) => new Date(year, month - 1, day, hour).getTime()
const SEASONS: readonly Entry[] = ENTRIES.filter(entry => entry.kind === 'season')

function registrySeason(time: number, hemisphere: Hemisphere): EntryId | undefined {
    const year = new Date(time).getFullYear()
    return SEASONS.find(entry => [year - 1, year].some(windowYear => {
        const window = entry.window(windowYear, hemisphere)
        return !!window && time >= window.start.getTime() && time < window.endExclusive.getTime()
    }))?.id
}
const storedLook = (id: string) => ({ theme: id === DEFAULT_THEME_ID ? undefined : id, season: undefined, dark: !isLightTheme(id) })

describe('index.html pre-paint script', () => {
    it('lists the light themes, the default theme, the Seasonal theme and the entries exactly as their registries do', () => {
        expect(listLiteral('lightThemes')).toEqual(LIGHT_THEME_IDS)
        expect(stringLiteral('defaultTheme')).toBe(DEFAULT_THEME_ID)
        expect(stringLiteral('seasonalTheme')).toBe(SEASONAL_THEME_ID)
        expect(listLiteral('entries')).toEqual(ENTRY_IDS)
    })

    it('carries the southern-zone table exactly as the hemisphere registry does', () => {
        expect(listLiteral('southernZones')).toEqual(SOUTHERN_ZONES)
    })

    it.each([2027, 2028])('lists the northern season of every month of %i exactly as the season windows do', year => {
        const months = listLiteral('seasonMonths')
        expect(months).toHaveLength(12)
        months.forEach((season, month) => {
            expect(registrySeason(new Date(year, month, 1).getTime(), 'north'), `${year}-${month + 1}-01`).toBe(season)
            expect(registrySeason(new Date(year, month + 1, 0, 23, 59).getTime(), 'north'), `the last day of ${year}-${month + 1}`).toBe(season)
        })
    })

    it.each(['north', 'south'] as const)('paints the season the windows give, in every month in the %s, on a cold cache', hemisphere => {
        for (let month = 0; month < 12; month++) {
            for (const now of [new Date(2028, month, 1, 0, 0).getTime(), new Date(2028, month + 1, 0, 23, 59).getTime()]) {
                expect(prePaint({ theme: 'seasonal', hemisphere: JSON.stringify(hemisphere), now }).season, new Date(now).toString()).toBe(registrySeason(now, hemisphere))
            }
        }
    })

    it.each(THEMES.map(theme => theme.id).filter(id => id !== SEASONAL_THEME_ID))('paints the stored %s theme before the app mounts', id => {
        expect(prePaint({ theme: id })).toMatchObject(storedLook(id))
    })

    it.each(ENTRY_IDS)('paints a cached %s on the Seasonal theme', id => {
        expect(prePaint({ theme: 'seasonal', cache: fresh(id) })).toMatchObject({ theme: 'seasonal', season: id, dark: true })
    })

    it('falls back to the month on the Seasonal theme from an expired, empty, unknown or unreadable cache', () => {
        for (const cache of [
            { id: 'christmas', until: NOW },
            { id: 'christmas', until: NOW - DAY },
            fresh(null),
            fresh('aurora'),
            fresh('none'),
            '{not json',
        ]) {
            expect(prePaint({ theme: 'seasonal', cache })).toMatchObject({ theme: 'seasonal', season: 'winter', dark: true })
            expect(prePaint({ theme: 'seasonal', cache, timeZone: 'Australia/Sydney' })).toMatchObject({ theme: 'seasonal', season: 'summer', dark: true })
        }
    })

    const COLD: Array<[string, string | null, number, EntryId]> = [
        ['July in London', 'Europe/London', at(2026, 7, 15), 'summer'],
        ['July in Sydney', 'Australia/Sydney', at(2026, 7, 15), 'winter'],
        ['January in Berlin', 'Europe/Berlin', at(2027, 1, 10), 'winter'],
        ['January in Auckland', 'Pacific/Auckland', at(2027, 1, 10), 'summer'],
        ['April in New York', 'America/New_York', at(2027, 4, 20), 'spring'],
        ['April in Sao Paulo', 'America/Sao_Paulo', at(2027, 4, 20), 'autumn'],
        ['October in Johannesburg', 'Africa/Johannesburg', at(2026, 10, 10), 'spring'],
        ['Feb 29 in Singapore', 'Asia/Singapore', at(2028, 2, 29), 'winter'],
        ['Mar 1 under a legacy southern alias', 'Australia/ACT', at(2028, 3, 1, 0), 'autumn'],
        ['an unknown zone in July', 'Mars/Olympus_Mons', at(2026, 7, 15), 'summer'],
        ['no readable zone in July', null, at(2026, 7, 15), 'summer'],
        ['Halloween in London, before the app resolves the holiday', 'Europe/London', at(2026, 10, 31, 20), 'autumn'],
        ['Christmas Eve in London, before the app resolves the holiday', 'Europe/London', at(2026, 12, 24), 'winter'],
    ]

    it.each(COLD)('paints the season on a cold cache from the month and the timezone: %s', (_, timeZone, now, season) => {
        expect(prePaint({ theme: 'seasonal', timeZone, now })).toMatchObject({ theme: 'seasonal', season, dark: true })
    })

    it('takes the stored hemisphere setting over the timezone, and auto or an unknown value as the timezone', () => {
        const july = at(2026, 7, 15)
        expect(prePaint({ theme: 'seasonal', timeZone: 'Australia/Sydney', hemisphere: '"north"', now: july }).season).toBe('summer')
        expect(prePaint({ theme: 'seasonal', timeZone: 'Europe/London', hemisphere: '"south"', now: july }).season).toBe('winter')
        expect(prePaint({ theme: 'seasonal', timeZone: 'Australia/Sydney', hemisphere: '"auto"', now: july }).season).toBe('winter')
        expect(prePaint({ theme: 'seasonal', timeZone: 'Australia/Sydney', hemisphere: '"east"', now: july }).season).toBe('winter')
        expect(prePaint({ theme: 'seasonal', timeZone: 'Australia/Sydney', hemisphere: '{not json', now: july }).season).toBe('winter')
    })

    it('takes the hemisphere preview, from the query then the session, over the stored setting', () => {
        const july = at(2026, 7, 15)
        expect(prePaint({ theme: 'seasonal', hemisphere: '"north"', hemispherePreview: 'south', now: july }).season).toBe('winter')
        expect(prePaint({ theme: 'seasonal', hemisphere: '"south"', search: '?hemisphere=north', hemispherePreview: 'south', now: july }).season).toBe('summer')
        expect(prePaint({ theme: 'seasonal', hemisphere: '"south"', search: '?hemisphere=auto', now: july }).season).toBe('winter')
        expect(prePaint({ theme: 'seasonal', timeZone: 'Australia/Sydney', hemispherePreview: 'east', now: july }).season).toBe('winter')
    })

    it('keeps an unexpired cache over the month and the hemisphere', () => {
        const july = at(2026, 7, 15)
        expect(prePaint({ theme: 'seasonal', cache: { id: 'halloween', until: july + DAY }, hemisphere: '"south"', now: july }).season).toBe('halloween')
    })

    it.each(THEMES.map(theme => theme.id).filter(id => id !== SEASONAL_THEME_ID))('gives the stored %s theme no season on a cold cache', id => {
        expect(prePaint({ theme: id, hemisphere: '"south"', timeZone: 'Australia/Sydney' })).toMatchObject(storedLook(id))
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
        expect(prePaint({ pathname, theme: 'seasonal' })).toMatchObject({ theme: 'seasonal', season: undefined })
        expect(prePaint({ ...preview, pathname, theme: 'light' })).toMatchObject({ theme: 'light', season: undefined, dark: false })
    })

    it('never reads the retired toggle or the retired cache', () => {
        const local = {
            'utbt:seasonalThemes:v1': JSON.stringify('on'),
            'utbt:season:v1': JSON.stringify(fresh(ENTRY_IDS[0])),
        }
        const painted = prePaint({ theme: 'seasonal', local })
        expect(painted.season).toBe('winter')
        expect(painted.reads).not.toContain('utbt:seasonalThemes:v1')
        expect(painted.reads).not.toContain('utbt:season:v1')
        expect(prePaint({ theme: 'classic', search: '?season=none', local }).reads).toEqual(
            expect.not.arrayContaining(['utbt:seasonalThemes:v1', 'utbt:season:v1']),
        )
    })
})
