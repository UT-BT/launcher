import { cn } from '@/lib/utils'

export type PlayerDetailTab = 'caps' | 'pbs' | 'wrs' | 'playtime' | 'uncapped' | 'achievements'

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
                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-200'
                            : 'bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20',
                    )}
                >
                    {t.label}
                    {typeof t.count === 'number' && (
                        <span className={cn(
                            'text-[10px] font-mono tabular-nums px-1 rounded',
                            active === t.value ? 'text-blue-100' : 'text-muted-foreground/70',
                        )}>
                            {t.count.toLocaleString()}
                        </span>
                    )}
                </button>
            ))}
        </div>
    )
}
