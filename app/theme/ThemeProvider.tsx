import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_THEME_ID, isThemeId } from './themes'

const STORAGE_KEY = 'utbt:theme:v1'

interface ThemeContextValue {
  themeId: string
  setThemeId: (id: string) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function loadThemeId(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_THEME_ID
    const parsed = JSON.parse(raw) as { id?: string }
    return isThemeId(parsed.id) ? parsed.id : DEFAULT_THEME_ID
  } catch {
    return DEFAULT_THEME_ID
  }
}

function applyThemeId(id: string) {
  const root = document.documentElement
  if (id === DEFAULT_THEME_ID) {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', id)
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<string>(loadThemeId)

  useEffect(() => {
    applyThemeId(themeId)
  }, [themeId])

  const setThemeId = useCallback((id: string) => {
    const next = isThemeId(id) ? id : DEFAULT_THEME_ID
    setThemeIdState(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: next }))
    } catch (err) {
      console.error('Failed to persist theme preference', err)
    }
  }, [])

  return <ThemeContext.Provider value={{ themeId, setThemeId }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}
