import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SEASON_IDS } from '@/app/seasonal/seasons'
import { DEFAULT_THEME_ID, LIGHT_THEME_IDS, THEMES, isLightTheme } from '@/app/theme/themes'

const html = readFileSync(resolve(__dirname, 'index.html'), 'utf8')
const script = html.match(/<script>([\s\S]*?)<\/script>/)![1]

function listLiteral(name: string): string[] {
    const literal = script.match(new RegExp(`var ${name} = \\[([^\\]]*)\\]`))![1]
    return [...literal.matchAll(/'([^']*)'/g)].map(match => match[1])
}

function stringLiteral(name: string): string {
    return script.match(new RegExp(`var ${name} = '([^']*)'`))![1]
}

function prePaint(input: { theme?: string; search?: string; pathname?: string }) {
    const attributes = new Map<string, string>()
    const classes = new Set(['dark'])
    const documentElement = {
        setAttribute: (name: string, value: string) => attributes.set(name, value),
        classList: { remove: (name: string) => classes.delete(name) },
    }
    const local: Record<string, string> = input.theme ? { 'utbt:theme:v1': JSON.stringify({ id: input.theme }) } : {}
    const storage = (entries: Record<string, string>) => ({ getItem: (key: string) => entries[key] ?? null })
    const location = { pathname: input.pathname ?? '/', search: input.search ?? '' }
    new Function('document', 'localStorage', 'sessionStorage', 'location', script)(
        { documentElement },
        storage(local),
        storage({}),
        location,
    )
    return { theme: attributes.get('data-theme'), season: attributes.get('data-season'), dark: classes.has('dark') }
}

describe('index.html pre-paint script', () => {
    it('lists the light themes, the default theme and the seasons exactly as their registries do', () => {
        expect(listLiteral('lightThemes')).toEqual(LIGHT_THEME_IDS)
        expect(stringLiteral('defaultTheme')).toBe(DEFAULT_THEME_ID)
        expect(listLiteral('seasons')).toEqual(SEASON_IDS)
    })

    it.each(THEMES.map(theme => theme.id))('paints the stored %s theme before the app mounts', id => {
        expect(prePaint({ theme: id })).toMatchObject({
            theme: id === DEFAULT_THEME_ID ? undefined : id,
            dark: !isLightTheme(id),
        })
    })

    it.each(SEASON_IDS)('paints a %s preview', id => {
        expect(prePaint({ search: `?season=${id}` }).season).toBe(id)
    })

    it('ignores an unknown season and keeps stream routes unseasoned', () => {
        expect(prePaint({ search: '?season=summer' }).season).toBeUndefined()
        expect(prePaint({ search: `?season=${SEASON_IDS[0]}`, pathname: '/stream/cup/42/overlay' }).season).toBeUndefined()
    })
})
