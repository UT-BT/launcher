import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_THEME_ID, isThemeId } from './themes'
import { getSynced, setSynced, subscribeSynced } from '@/app/utils/userState'

const STORAGE_KEY = 'utbt:theme:v1'

interface ThemeContextValue {
  themeId: string
  setThemeId: (id: string) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function loadThemeId(): string {
  const stored = getSynced<{ id?: string } | null>(STORAGE_KEY, null)
  return stored && isThemeId(stored.id) ? stored.id : DEFAULT_THEME_ID
}

function applyThemeId(id: string) {
  const root = document.documentElement
  if (id === DEFAULT_THEME_ID) {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', id)
  }
  root.classList.toggle('dark', id !== 'light')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<string>(loadThemeId)

  useEffect(() => {
    applyThemeId(themeId)
  }, [themeId])

  useEffect(() => subscribeSynced(STORAGE_KEY, () => setThemeIdState(loadThemeId())), [])

  const setThemeId = useCallback((id: string) => {
    const next = isThemeId(id) ? id : DEFAULT_THEME_ID
    applyThemeId(next)
    setThemeIdState(next)
    setSynced(STORAGE_KEY, { id: next })
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
