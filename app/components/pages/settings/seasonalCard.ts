import seasonsCss from '@/app/styles/seasons.css?raw'
import themesCss from '@/app/styles/themes.css?raw'
import { SEASONAL_THEME_ID } from '@/app/seasonal/appearance'
import type { Hemisphere } from '@/app/seasonal/hemisphere'
import type { Entry, EntryId } from '@/app/seasonal/seasons'

const HEMISPHERE_LABELS: Record<Hemisphere, string> = { north: 'Northern', south: 'Southern' }
const BASE_SELECTOR = `:root[data-theme='${SEASONAL_THEME_ID}']`
const SHIPPED_STYLESHEETS = [seasonsCss, themesCss]

function declaredAccent(stylesheets: readonly string[], selector: string): string | null {
    for (const css of stylesheets) {
        const blocks = css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)
        for (const [, blockSelector, body] of blocks) {
            if (blockSelector.trim() !== selector) continue
            const accent = body.match(/(?:^|[\s;])--accent-500\s*:\s*([^;]+);/)
            if (accent) return accent[1].trim()
        }
    }
    return null
}

export function hemisphereLabel(hemisphere: Hemisphere): string {
    return HEMISPHERE_LABELS[hemisphere]
}

export function seasonalSummary(entry: Pick<Entry, 'label' | 'kind'> | null, hemisphere: Hemisphere): string | null {
    if (!entry) return null
    return entry.kind === 'season'
        ? `Now: ${entry.label} · ${hemisphereLabel(hemisphere)} hemisphere`
        : `Now: ${entry.label}`
}

export function seasonalAccent(entry: EntryId | null, stylesheets: readonly string[] = SHIPPED_STYLESHEETS): string {
    const own = entry ? declaredAccent(stylesheets, `${BASE_SELECTOR}[data-season='${entry}']`) : null
    return own ?? declaredAccent(stylesheets, BASE_SELECTOR) ?? ''
}
