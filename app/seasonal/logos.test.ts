import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SEASON_IDS } from './seasons'

describe('seasonal logos', () => {
    it.each(SEASON_IDS)('%s has its logo file', id => {
        expect(existsSync(resolve(__dirname, `../assets/seasonal/logo-${id}.webp`))).toBe(true)
    })
})
