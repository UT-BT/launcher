import { cn } from '@/lib/utils'

export type ChartView = 'cumulative' | 'sectors'

const OPTIONS: { view: ChartView; label: string }[] = [
    { view: 'cumulative', label: 'Cumulative' },
    { view: 'sectors', label: 'Per sector' },
]

interface ChartViewToggleProps {
    view: ChartView
    onChange: (view: ChartView) => void
}

export function ChartViewToggle({ view, onChange }: ChartViewToggleProps) {
    return (
        <div role="group" aria-label="Chart view" className="flex gap-1 shrink-0">
            {OPTIONS.map(option => {
                const active = option.view === view
                return (
                    <button
                        key={option.view}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onChange(option.view)}
                        className={cn(
                            'h-8 lg:h-6 px-2.5 lg:px-2 rounded border text-[11px] lg:text-[10px] font-medium transition-colors cursor-pointer',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60',
                            active
                                ? 'bg-accent-500/20 border-accent-500/50 text-accent-200'
                                : 'bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20',
                        )}
                    >
                        {option.label}
                    </button>
                )
            })}
        </div>
    )
}
