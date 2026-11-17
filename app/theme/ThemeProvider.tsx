import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_THEME_ID, isLightTheme, isThemeId } from './themes'
import { getSynced, setSynced, subscribeSynced } from '@/app/utils/userState'

const STORAGE_KEY = 'utbt:theme:v1'

interface ThemeContextValue {
  themeId: string
  setThemeId: (id: string) => void
  setPreviewThemeId: (id: string | null) => void
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
  root.classList.toggle('dark', !isLightTheme(id))
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<string>(loadThemeId)
  const [previewThemeId, setPreviewThemeIdState] = useState<string | null>(null)
  const shownThemeId = previewThemeId ?? themeId

  useEffect(() => {
    applyThemeId(shownThemeId)
  }, [shownThemeId])

  useEffect(() => subscribeSynced(STORAGE_KEY, () => setThemeIdState(loadThemeId())), [])

  const setThemeId = useCallback((id: string) => {
    const next = isThemeId(id) ? id : DEFAULT_THEME_ID
    applyThemeId(previewThemeId ?? next)
    setThemeIdState(next)
    setSynced(STORAGE_KEY, { id: next })
  }, [previewThemeId])

  const setPreviewThemeId = useCallback((id: string | null) => {
    setPreviewThemeIdState(isThemeId(id) ? id : null)
  }, [])

  return <ThemeContext.Provider value={{ themeId, setThemeId, setPreviewThemeId }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}
