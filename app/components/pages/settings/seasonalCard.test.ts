import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ENTRY_IDS } from '@/app/seasonal/seasons'
import { seasonalAccent, seasonalSummary } from './seasonalCard'

const SHIPPED = ['seasons.css', 'themes.css'].map(file => readFileSync(resolve(__dirname, '../../../styles', file), 'utf8'))

const BASE = `
:root { --accent-500: red; }
:root[data-theme='red'] { --accent-500: crimson; }
/* the Seasonal base */
:root[data-theme='seasonal'] {
  --accent-400: navy;
  --accent-500: oklch(0.623 0.214 259.815);
}
`

const ENTRY_BLOCKS = `
:root[data-theme='seasonal'][data-season='halloween'] {
  --accent-400: orange;
  --accent-500: oklch(0.625 0.205 44);
}

:root[data-theme='seasonal'][data-season='christmas'] {
  --background: oklch(0.2 0.02 20);
}
`

describe('seasonalSummary', () => {
    it('names a holiday alone', () => {
        expect(seasonalSummary({ label: 'Halloween', kind: 'holiday' }, 'south')).toBe('Now: Halloween')
    })

    it('names a season with its hemisphere', () => {
        expect(seasonalSummary({ label: 'Autumn', kind: 'season' }, 'south')).toBe('Now: Autumn · Southern hemisphere')
        expect(seasonalSummary({ label: 'Spring', kind: 'season' }, 'north')).toBe('Now: Spring · Northern hemisphere')
    })

    it('says nothing when no entry resolves', () => {
        expect(seasonalSummary(null, 'north')).toBeNull()
    })
})

describe('seasonalAccent', () => {
    it("takes the entry's accent from its block", () => {
        expect(seasonalAccent('halloween', [ENTRY_BLOCKS, BASE])).toBe('oklch(0.625 0.205 44)')
    })

    it('falls back to the Seasonal base block when the entry block sets no accent', () => {
        expect(seasonalAccent('christmas', [ENTRY_BLOCKS, BASE])).toBe('oklch(0.623 0.214 259.815)')
    })

    it('falls back to the Seasonal base block when nothing resolves', () => {
        expect(seasonalAccent(null, [ENTRY_BLOCKS, BASE])).toBe('oklch(0.623 0.214 259.815)')
    })

    it('falls back to the Seasonal base block for an entry without a block', () => {
        expect(seasonalAccent('easter', [ENTRY_BLOCKS, BASE])).toBe('oklch(0.623 0.214 259.815)')
    })

    it('reads every registry entry and the base from the shipped stylesheets', () => {
        for (const id of [...ENTRY_IDS, null]) expect(seasonalAccent(id, SHIPPED)).toMatch(/^(oklch|hsl|rgb|#)/)
    })
})
