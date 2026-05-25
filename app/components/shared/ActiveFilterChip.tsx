import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ActiveFilterChipProps {
    label: string
    value: string
    onClear: () => void
    className?: string
}

/**
 * Removable filter chip shown above the data table when a filter is active.
 * Click X to clear that single filter value. Pages compose a row of these
 * from their own filter state.
 */
export function ActiveFilterChip({ label, value, onClear, className }: ActiveFilterChipProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 h-7 pl-2 pr-1 rounded-md text-xs font-medium border bg-blue-500/10 border-blue-500/30 text-blue-200',
                className,
            )}
        >
            <span className="text-[10px] uppercase tracking-wider text-blue-300/70 font-bold">
                {label}
            </span>
            <span className="text-blue-100 truncate max-w-[160px]">{value}</span>
            <button
                type="button"
                onClick={onClear}
                aria-label={`Remove ${label} filter ${value}`}
                className="p-0.5 rounded hover:bg-blue-500/30 text-blue-200 hover:text-white transition-colors cursor-pointer"
            >
                <X className="size-3" />
            </button>
        </span>
    )
}
