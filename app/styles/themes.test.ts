import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME_ID, THEMES } from '@/app/theme/themes'

const themesCss = readFileSync(resolve(__dirname, 'themes.css'), 'utf8')

const selectors = [...themesCss.matchAll(/([^{}]+)\{[^{}]*\}/g)].map(match =>
    match[1].split(',').map(selector => selector.trim())
)

function themeIdsIn(group: string[], suffix: string): string[] {
    return group.flatMap(selector => {
        const match = selector.match(new RegExp(`^:root\\[data-theme='([\\w-]+)'\\]${suffix}$`))
        return match ? [match[1]] : []
    })
}

describe('themes.css', () => {
    it('has a palette block for every registered theme but the default, and none for unknown ids', () => {
        const palettes = selectors.flatMap(group => themeIdsIn(group, ''))
        expect([...palettes].sort()).toEqual(THEMES.map(theme => theme.id).filter(id => id !== DEFAULT_THEME_ID).sort())
    })

    it('hides the nebula backdrop for exactly the solid themes', () => {
        const hidden = selectors.flatMap(group => themeIdsIn(group, ' \\.nebula-bg'))
        expect(hidden.sort()).toEqual(THEMES.filter(theme => theme.group === 'solid').map(theme => theme.id).sort())
    })
})
