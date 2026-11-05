import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { logoFor } from './logos'
import { ENTRIES, ENTRY_IDS, type Entry } from './seasons'

const REGISTRY: readonly Entry[] = ENTRIES

describe('seasonal logos', () => {
    it.each(REGISTRY.filter(entry => !entry.logo).map(entry => entry.id))('%s has its logo file', id => {
        expect(existsSync(resolve(__dirname, `../assets/seasonal/logo-${id}.webp`))).toBe(true)
    })

    it.each(REGISTRY.map(entry => [entry.id, entry.logo ?? entry.id]))('%s shows logo-%s', (id, file) => {
        expect(logoFor(id)).toMatch(new RegExp(`logo-${file}\\.webp$`))
    })

    it('shows the Christmas logo for Summer Christmas, so the logo never depends on the hemisphere', () => {
        expect(logoFor('christmas-summer')).toBe(logoFor('christmas'))
    })

    it('shows the normal logo with no logo entry', () => {
        expect(logoFor(null)).toMatch(/assets\/logo\.webp$/)
    })

    it('aliases a logo only to an entry that has its own file', () => {
        for (const entry of REGISTRY.filter(candidate => candidate.logo)) {
            expect(ENTRY_IDS).toContain(entry.logo)
            expect(REGISTRY.find(candidate => candidate.id === entry.logo)?.logo).toBeUndefined()
        }
    })
})
