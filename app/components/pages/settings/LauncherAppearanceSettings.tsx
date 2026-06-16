import { Palette, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SettingsSection } from './SettingsComponents'
import { useTheme } from '@/app/theme/ThemeProvider'
import { THEMES } from '@/app/theme/themes'

export function LauncherAppearanceSettings() {
    const { themeId, setThemeId } = useTheme()

    return (
        <div className="space-y-6">
            <div className="pl-1">
                <h2 className="text-2xl font-bold tracking-tight">Appearance</h2>
                <p className="text-muted-foreground">Choose a colour palette for the launcher.</p>
            </div>

            <SettingsSection title="Accent Theme" icon={Palette}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                    {THEMES.map((theme) => {
                        const active = theme.id === themeId
                        return (
                            <button
                                key={theme.id}
                                onClick={() => setThemeId(theme.id)}
                                aria-pressed={active}
                                className={cn(
                                    "relative flex items-center gap-3 rounded-lg border p-3 text-left transition-colors cursor-pointer",
                                    active
                                        ? "bg-accent-500/15 border-accent-500/50"
                                        : "bg-card/50 border-white/10 hover:border-white/20 hover:bg-card/80"
                                )}
                            >
                                <span
                                    className="size-9 shrink-0 rounded-md border border-white/10"
                                    style={{ background: theme.swatch }}
                                />
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-white truncate">{theme.label}</div>
                                    <div className="text-xs text-muted-foreground truncate">{theme.description}</div>
                                </div>
                                {active && <Check className="size-4 text-accent-300 absolute top-2 right-2" />}
                            </button>
                        )
                    })}
                </div>
            </SettingsSection>
        </div>
    )
}
