import { cn } from '@/lib/utils'

export function Segmented({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer',
                active
                    ? 'bg-accent-500/20 border-accent-500/50 text-accent-300'
                    : 'bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20',
            )}
        >
            {label}
        </button>
    )
}
