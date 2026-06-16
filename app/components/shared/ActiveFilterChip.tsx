import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ActiveFilterChipProps {
    label: string
    value: string
    onClear: () => void
    className?: string
}

export function ActiveFilterChip({ label, value, onClear, className }: ActiveFilterChipProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 h-7 pl-2 pr-1 rounded-md text-xs font-medium border bg-accent-500/10 border-accent-500/30 text-accent-200',
                className,
            )}
        >
            <span className="text-[10px] uppercase tracking-wider text-accent-300/70 font-bold">
                {label}
            </span>
            <span className="text-accent-100 truncate max-w-[160px]">{value}</span>
            <button
                type="button"
                onClick={onClear}
                aria-label={`Remove ${label} filter ${value}`}
                className="p-0.5 rounded hover:bg-accent-500/30 text-accent-200 hover:text-white transition-colors cursor-pointer"
            >
                <X className="size-3" />
            </button>
        </span>
    )
}
