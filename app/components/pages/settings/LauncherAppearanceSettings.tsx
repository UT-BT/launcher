import { Palette, Contrast, Check, Lock, Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SettingsSection } from './SettingsComponents'
import { openExternal } from '@/app/platform'
import { useTheme } from '@/app/theme/ThemeProvider'
import { THEMES, type ThemeMeta } from '@/app/theme/themes'

interface LauncherAppearanceSettingsProps {
    unlockExclusive?: boolean
}

export function LauncherAppearanceSettings({ unlockExclusive }: LauncherAppearanceSettingsProps) {
    const { themeId, setThemeId } = useTheme()

    const renderCard = (theme: ThemeMeta) => {
        const active = theme.id === themeId
        const locked = !!theme.exclusive && !unlockExclusive
        return (
            <button
                key={theme.id}
                onClick={() => {
                    if (locked) openExternal('https://patreon.com/utbt')
                    else setThemeId(theme.id)
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
                    style={{ background: theme.swatch }}
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
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                        {locked ? 'Patreon supporters only. Click to join' : theme.description}
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
            </SettingsSection>

            <SettingsSection title="Solid Colours" icon={Contrast}>
                <div className="grid grid-cols-1 @md/panel:grid-cols-2 gap-3 p-4">
                    {solid.map(renderCard)}
                </div>
            </SettingsSection>
        </div>
    )
}
