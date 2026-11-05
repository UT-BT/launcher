import { useSyncExternalStore } from 'react'
import { Palette, Contrast, Check, Lock, Heart, Clock, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SettingsSection, SettingsRow } from './SettingsComponents'
import { Switch } from '@/app/components/ui/switch'
import { openExternal } from '@/app/platform'
import { useTheme } from '@/app/theme/ThemeProvider'
import { THEMES, type ThemeMeta } from '@/app/theme/themes'
import { TIMEZONE_OPTIONS, browserResolvedTimezone, useDisplayTimezoneOverride } from '@/app/utils/timezone'
import {
    loadSeasonalEffects,
    readSeasonOverride,
    saveSeasonalEffects,
    subscribeSeasonalEffects,
    subscribeSeasonOverride,
    writeSeasonOverride,
} from '@/app/seasonal/preferences'
import { ENTRIES, isEntryPreview } from '@/app/seasonal/seasons'
import { SEASONAL_THEME_ID } from '@/app/seasonal/appearance'
import { dismissSeasonalNotice } from '@/app/components/pages/home/seasonalNoticeStorage'
import { HemisphereRow, useSeasonalCard } from './SeasonalThemeOptions'

const SEASON_PREVIEW_OPTIONS = [
    { value: '', label: 'Automatic (by date)' },
    { value: 'none', label: 'No season' },
    ...ENTRIES.map(entry => ({ value: entry.id, label: entry.label })),
]

interface LauncherAppearanceSettingsProps {
    unlockExclusive?: boolean
}

export function LauncherAppearanceSettings({ unlockExclusive }: LauncherAppearanceSettingsProps) {
    const { themeId, setThemeId } = useTheme()
    const [timezoneOverride, setTimezoneOverride] = useDisplayTimezoneOverride()
    const seasonPreview = useSyncExternalStore(subscribeSeasonOverride, readSeasonOverride)
    const seasonalCard = useSeasonalCard()
    const seasonalEffects = useSyncExternalStore(subscribeSeasonalEffects, loadSeasonalEffects)

    const renderCard = (theme: ThemeMeta) => {
        const active = theme.id === themeId
        const locked = !!theme.exclusive && !unlockExclusive
        const seasonal = theme.id === SEASONAL_THEME_ID
        return (
            <button
                key={theme.id}
                onClick={() => {
                    if (locked) openExternal('https://patreon.com/utbt')
                    else {
                        setThemeId(theme.id)
                        if (seasonal) dismissSeasonalNotice()
                    }
                }}
                aria-pressed={active}
                title={locked ? 'Exclusive to Patreon supporters — click to learn more' : undefined}
                className={cn(
                    "relative flex items-center gap-3 rounded-lg border p-3 text-left transition-all duration-150 cursor-pointer active:scale-[0.99]",
                    active
                        ? "bg-accent-500/15 border-accent-500/50"
                        : "bg-card/50 border-hairline/10 hover:border-hairline/20 hover:bg-card/80 active:border-hairline/30",
                    locked && "opacity-65",
                )}
            >
                <span
                    className="size-9 shrink-0 rounded-md border border-hairline/10"
                    style={{ background: seasonal ? seasonalCard.swatch : theme.swatch }}
                />
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-foreground truncate">{theme.label}</span>
                        {theme.exclusive && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-amber-400/15 border border-amber-400/40 text-amber-300 shrink-0">
                                <Heart className="size-2.5 fill-current" />
                                Patreon
                            </span>
                        )}
                        {theme.new && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-hairline/10 border border-hairline/25 text-foreground shrink-0">
                                <Sparkles className="size-2.5" />
                                New
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                        {locked
                            ? 'Patreon supporters only. Click to join'
                            : (seasonal && seasonalCard.summary) || theme.description}
                    </div>
                </div>
                {locked
                    ? <Lock className="size-3.5 text-muted-foreground absolute top-2 right-2" />
                    : active && <Check className="size-4 text-accent-300 absolute top-2 right-2" />}
            </button>
        )
    }

    const gradients = THEMES.filter((t) => t.group === 'gradients')
    const solid = THEMES.filter((t) => t.group === 'solid')

    return (
        <div className="space-y-6">
            <div className="pl-1">
                <h2 className="text-2xl font-bold tracking-tight">Appearance</h2>
                <p className="text-muted-foreground">Choose a colour palette for the launcher.</p>
            </div>

            <SettingsSection title="Gradients" icon={Palette}>
                <div className="grid grid-cols-1 @md/panel:grid-cols-2 gap-3 p-4">
                    {gradients.map(renderCard)}
                </div>
                {themeId === SEASONAL_THEME_ID && (
                    <>
                        <HemisphereRow />
                        <SettingsRow
                            label="Effects"
                            description="Ambient effects behind the pages, and a burst when you click the logo."
                        >
                            <Switch
                                aria-label="Seasonal effects"
                                checked={seasonalEffects}
                                onCheckedChange={saveSeasonalEffects}
                                className="h-11 border-x-0 border-y-[10px] px-0.5 bg-clip-padding"
                            />
                        </SettingsRow>
                    </>
                )}
            </SettingsSection>

            <SettingsSection title="Solid Colours" icon={Contrast}>
                <div className="grid grid-cols-1 @md/panel:grid-cols-2 gap-3 p-4">
                    {solid.map(renderCard)}
                </div>
            </SettingsSection>

            {import.meta.env.DEV && (
                <SettingsSection title="Season Preview" icon={Sparkles}>
                    <SettingsRow label="Season preview" description="Development only. Shows a season or holiday on the Seasonal theme for this session.">
                        <select
                            value={seasonPreview ?? ''}
                            onChange={e => writeSeasonOverride(isEntryPreview(e.target.value) ? e.target.value : null)}
                            style={{ colorScheme: 'dark' }}
                            className="h-9 w-full @md/panel:w-64 rounded-md border border-hairline/10 bg-card/50 px-3 text-sm text-foreground"
                        >
                            {SEASON_PREVIEW_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </SettingsRow>
                </SettingsSection>
            )}

            <SettingsSection title="Time Zone" icon={Clock}>
                <SettingsRow
                    label="Display time zone"
                    description="Times across the launcher use your device's time zone unless you pin one here. Useful if you're travelling or your device is set to the wrong zone."
                >
                    <select
                        value={timezoneOverride ?? ''}
                        onChange={e => setTimezoneOverride(e.target.value || null)}
                        style={{ colorScheme: 'dark' }}
                        className="h-9 w-full @md/panel:w-64 rounded-md border border-hairline/10 bg-card/50 px-3 text-sm text-foreground"
                    >
                        <option value="">Browser default ({browserResolvedTimezone()})</option>
                        {TIMEZONE_OPTIONS.map(tz => (
                            <option key={tz} value={tz}>{tz}</option>
                        ))}
                    </select>
                </SettingsRow>
            </SettingsSection>
        </div>
    )
}
