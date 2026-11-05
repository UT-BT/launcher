import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME_ID, LIGHT_THEME_IDS, THEMES, isLightTheme, isThemeId } from './themes'

describe('isLightTheme', () => {
  it('is on for the White theme only', () => {
    expect(isLightTheme('light')).toBe(true)
    for (const id of ['classic', 'red', 'aurum', 'black', 'slate-blue-squared']) expect(isLightTheme(id)).toBe(false)
  })

  it('is off for an unknown or missing theme id', () => {
    expect(isLightTheme('white')).toBe(false)
    expect(isLightTheme(null)).toBe(false)
    expect(isLightTheme(undefined)).toBe(false)
  })
})

describe('LIGHT_THEME_IDS', () => {
  it('lists the registry entries flagged light', () => {
    expect(LIGHT_THEME_IDS).toEqual(THEMES.filter((theme) => theme.light).map((theme) => theme.id))
  })
})

describe('the Seasonal theme', () => {
  const ids = THEMES.map((theme) => theme.id)
  const seasonal = THEMES.find((theme) => theme.id === 'seasonal')

  it('is a free, dark gradients theme', () => {
    expect(seasonal).toMatchObject({ label: 'Seasonal', group: 'gradients' })
    expect(seasonal?.exclusive).toBeFalsy()
    expect(isLightTheme('seasonal')).toBe(false)
  })

  it('sits right after UTBT Red, before the Patreon themes', () => {
    expect(ids.indexOf('seasonal')).toBe(ids.indexOf('red') + 1)
    expect(ids.indexOf('seasonal')).toBeLessThan(THEMES.findIndex((theme) => theme.exclusive))
  })

  it('is the only theme marked new', () => {
    expect(THEMES.filter((theme) => theme.new).map((theme) => theme.id)).toEqual(['seasonal'])
  })

  it('keeps Classic as the default', () => {
    expect(DEFAULT_THEME_ID).toBe('classic')
  })
})

describe('isThemeId', () => {
  it('accepts every registered theme, Seasonal included', () => {
    for (const { id } of THEMES) expect(isThemeId(id)).toBe(true)
    expect(isThemeId('seasonal')).toBe(true)
  })

  it('rejects an id this launcher does not know, so a stored one falls back to Classic', () => {
    for (const id of ['aurora', 'Seasonal', '', null, undefined]) expect(isThemeId(id)).toBe(false)
  })
})
