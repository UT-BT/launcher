import { cn } from '@/lib/utils'
import type { StageChip } from './statsView'

interface StageChipsProps {
    chips: StageChip[]
    onSelect: (key: string | null) => void
}

export function StageChips({ chips, onSelect }: StageChipsProps) {
    return (
        <div role="group" aria-label="Stage" className="flex min-w-0 flex-wrap items-center gap-1.5">
            {chips.map(chip => (
                <button
                    key={chip.key ?? 'all'}
                    type="button"
                    aria-pressed={chip.active}
                    onClick={() => onSelect(chip.key)}
                    className={cn(
                        'h-8 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors cursor-pointer',
                        chip.active
                            ? 'border-accent-500/60 bg-accent-500/15 text-foreground'
                            : 'border-hairline/15 text-muted-foreground hover:border-hairline/25 hover:text-foreground',
                    )}
                >
                    {chip.label}
                </button>
            ))}
        </div>
    )
}
