export interface ThemeMeta {
  id: string
  label: string
  description: string
  swatch: string
  group: 'gradients' | 'solid'
  exclusive?: boolean
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'classic',
    label: 'UTBT Blue',
    description: 'Blue team supporters',
    swatch: '#3b82f6',
    group: 'gradients',
  },
  {
    id: 'red',
    label: 'UTBT Red',
    description: 'Red team supporters',
    swatch: '#dc2626',
    group: 'gradients',
  },
  {
    id: 'aurum',
    label: 'Aurum',
    description: 'Liquid Gold (Patreon exclusive style)',
    swatch: '#fbbf24',
    group: 'gradients',
    exclusive: true,
  },
  {
    id: 'amethyst',
    label: 'Amethyst',
    description: 'Royal Violet (Patreon exclusive style)',
    swatch: '#8b5cf6',
    group: 'gradients',
    exclusive: true,
  },
  {
    id: 'emerald',
    label: 'Emerald',
    description: 'Emerald green (Patreon exclusive style)',
    swatch: '#10b981',
    group: 'gradients',
    exclusive: true,
  },
  {
    id: 'rose',
    label: 'Rosé',
    description: 'Rosé pink (Patreon exclusive style)',
    swatch: '#ec4899',
    group: 'gradients',
    exclusive: true,
  },
  {
    id: 'light',
    label: 'White',
    description: "It'll burn your retinas out",
    swatch: '#f1f5f9',
    group: 'solid',
  },
  {
    id: 'black',
    label: 'Black',
    description: "No colours allowed",
    swatch: '#000000',
    group: 'solid',
  },
  {
    id: 'slate-blue-squared',
    label: 'Slate Blue Squared',
    description: 'Dark slate blue with squared corners',
    swatch: '#3d5f8a',
    group: 'solid',
  },
]

export const DEFAULT_THEME_ID = 'classic'

const THEME_IDS = new Set(THEMES.map((t) => t.id))

export function isThemeId(id: string | null | undefined): id is string {
  return typeof id === 'string' && THEME_IDS.has(id)
}
