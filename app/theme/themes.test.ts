import { describe, expect, it } from 'vitest'
import { LIGHT_THEME_IDS, THEMES, isLightTheme } from './themes'

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
