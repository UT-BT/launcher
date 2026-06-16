export interface ThemeMeta {
  id: string
  label: string
  description: string
  swatch: string
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'classic',
    label: 'Classic Blue',
    description: 'The original UTBT palette.',
    swatch: '#3b82f6',
  },
  {
    id: 'amethyst',
    label: 'Amethyst',
    description: 'Violet accent over a faintly purple dark.',
    swatch: '#8b5cf6',
  },
  {
    id: 'hydro',
    label: 'Hydro',
    description: 'Cyan accent over a faintly teal dark.',
    swatch: '#06b6d4',
  },
  {
    id: 'gunmetal',
    label: 'Gunmetal',
    description: 'Desaturated steel — the most subtle palette.',
    swatch: '#64748b',
  },
]

export const DEFAULT_THEME_ID = 'classic'

const THEME_IDS = new Set(THEMES.map((t) => t.id))

export function isThemeId(id: string | null | undefined): id is string {
  return typeof id === 'string' && THEME_IDS.has(id)
}
