import { useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'
import { SettingsRow } from './SettingsComponents'
import { hemisphereLabel, seasonalAccent, seasonalSummary } from './seasonalCard'
import { SEASONAL_THEME_ID, resolveAppearance } from '@/app/seasonal/appearance'
import { deviceTimeZone, type HemisphereSetting } from '@/app/seasonal/hemisphere'
import { readEntryPreview, saveHemisphereSetting, subscribeSeasonOverride } from '@/app/seasonal/preferences'
import { useHemisphere } from '@/app/seasonal/SeasonProvider'
import { ENTRIES } from '@/app/seasonal/seasons'

const HEMISPHERE_SETTINGS: readonly HemisphereSetting[] = ['auto', 'north', 'south']

export function useSeasonalCard(): { swatch: string; summary: string | null } {
    const preview = useSyncExternalStore(subscribeSeasonOverride, readEntryPreview, () => null)
    const { resolved } = useHemisphere()
    const { seasonal } = resolveAppearance({
        now: new Date(),
        themeId: SEASONAL_THEME_ID,
        preview,
        timeZone: deviceTimeZone(),
        hemisphereSetting: resolved,
        hemispherePreview: null,
    })
    const entry = ENTRIES.find(candidate => candidate.id === seasonal) ?? null
    return { swatch: seasonalAccent(seasonal), summary: seasonalSummary(entry, resolved) }
}

export function HemisphereRow() {
    const { detected, setting } = useHemisphere()
    return (
        <SettingsRow
            label="Hemisphere"
            description="Seasons follow your hemisphere. Auto reads it from your device's time zone."
        >
            <div role="group" aria-label="Hemisphere" className="flex w-full flex-wrap gap-2 @md/panel:w-auto">
                {HEMISPHERE_SETTINGS.map(option => {
                    const active = option === setting
                    return (
                        <button
                            key={option}
                            type="button"
                            aria-pressed={active}
                            onClick={() => saveHemisphereSetting(option)}
                            className={cn(
                                'min-h-11 flex-1 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition-all cursor-pointer active:scale-[0.99] @md/panel:flex-none',
                                active
                                    ? 'bg-accent-500/20 border-accent-500/50 text-accent-300'
                                    : 'bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20 active:border-hairline/30',
                            )}
                        >
                            {option === 'auto' ? `Auto (${hemisphereLabel(detected)})` : hemisphereLabel(option)}
                        </button>
                    )
                })}
            </div>
        </SettingsRow>
    )
}
