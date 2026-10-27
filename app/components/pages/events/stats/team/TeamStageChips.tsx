import { cn } from '@/lib/utils'
import type { StageChip } from '@/app/components/pages/events/stats/statsView'

export function TeamStageChips({ chips, onSelect }: { chips: StageChip[]; onSelect: (key: string | null) => void }) {
    return (
        <div role="group" aria-label="Stage" className="flex flex-wrap gap-2">
            {chips.map(chip => (
                <button
                    key={chip.key ?? 'all'}
                    type="button"
                    aria-pressed={chip.active}
                    onClick={() => onSelect(chip.key)}
                    className={cn(
                        'flex h-8 cursor-pointer items-center rounded-lg border px-3 text-xs font-medium transition-colors',
                        chip.active
                            ? 'border-accent-500/50 bg-accent-500/20 text-accent-300'
                            : 'border-hairline/10 bg-card/50 text-muted-foreground hover:border-hairline/20 hover:text-foreground',
                    )}
                >
                    {chip.label}
                </button>
            ))}
        </div>
    )
}
