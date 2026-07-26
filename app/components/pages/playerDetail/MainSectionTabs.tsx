import { cn } from '@/lib/utils'

export type PlayerDetailTab = 'caps' | 'disallowed' | 'pbs' | 'wrs' | 'playtime' | 'uncapped' | 'achievements' | 'maps'

interface MainSectionTabsProps {
    tabs: { value: PlayerDetailTab; label: string; count?: number; hidden?: boolean }[]
    active: PlayerDetailTab
    onChange: (tab: PlayerDetailTab) => void
}

export function MainSectionTabs({ tabs, active, onChange }: MainSectionTabsProps) {
    return (
        <div className="flex items-center gap-1 flex-wrap">
            {tabs.filter(t => !t.hidden).map(t => (
                <button
                    key={t.value}
                    type="button"
                    onClick={() => onChange(t.value)}
                    className={cn(
                        'h-7 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer inline-flex items-center gap-1.5',
                        active === t.value
                            ? 'bg-accent-500/20 border-accent-500/50 text-accent-200'
                            : 'bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20',
                    )}
                >
                    {t.label}
                    {typeof t.count === 'number' && (
                        <span className={cn(
                            'text-[10px] font-mono tabular-nums px-1 rounded',
                            active === t.value ? 'text-accent-100' : 'text-muted-foreground/70',
                        )}>
                            {t.count.toLocaleString()}
                        </span>
                    )}
                </button>
            ))}
        </div>
    )
}
