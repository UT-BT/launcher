import { Loader2, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/app/components/ui/tooltip'

type Variant = 'review' | 'replay' | 'download'

const VARIANT_CLASSES: Record<Variant, string> = {
    review: 'bg-orange-500/10 border-orange-500/30 text-orange-300 hover:bg-orange-500/25 hover:border-orange-500/60',
    replay: 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/25 hover:border-amber-500/60',
    download: 'bg-accent-500/10 border-accent-500/30 text-accent-300 hover:bg-accent-500/25 hover:border-accent-500/60',
}

interface IconActionButtonProps {
    variant: Variant
    icon: LucideIcon
    tooltip: string
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
    loading?: boolean
    disabled?: boolean
    className?: string
    iconFill?: boolean
    stopPropagation?: boolean
}

export function IconActionButton({
    variant, icon: Icon, tooltip, onClick,
    loading, disabled, className, iconFill, stopPropagation = true,
}: IconActionButtonProps) {
    const isDisabled = disabled || loading
    const tooltipContent = loading ? 'Loading…' : tooltip

    return (
        <Tooltip content={tooltipContent} side="top">
            <button
                type="button"
                disabled={isDisabled}
                onClick={e => {
                    if (stopPropagation) e.stopPropagation()
                    onClick(e)
                }}
                className={cn(
                    'inline-flex items-center justify-center size-7 rounded-md border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
                    VARIANT_CLASSES[variant],
                    className,
                )}
            >
                {loading
                    ? <Loader2 className="size-3 animate-spin" />
                    : <Icon className={cn('size-3', iconFill && 'fill-current')} />
                }
            </button>
        </Tooltip>
    )
}
