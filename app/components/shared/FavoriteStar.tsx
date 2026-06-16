import { Star } from 'lucide-react'
import { Tooltip } from '@/app/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface FavoriteStarProps {
    name: string
    isFavorited: boolean
    onToggle: (name: string) => void
    size?: 'sm' | 'md' | 'lg'
    className?: string
    disabled?: boolean
}

const SIZE_PX: Record<NonNullable<FavoriteStarProps['size']>, string> = {
    sm: 'size-3.5',
    md: 'size-4',
    lg: 'size-5',
}

const PADDING: Record<NonNullable<FavoriteStarProps['size']>, string> = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2',
}

export function FavoriteStar({
    name,
    isFavorited,
    onToggle,
    size = 'md',
    className,
    disabled = false,
}: FavoriteStarProps) {
    return (
        <Tooltip content={isFavorited ? 'Remove favorite' : 'Add to favorites'} side="top">
            <button
                type="button"
                aria-label={isFavorited ? `Unfavorite ${name}` : `Favorite ${name}`}
                aria-pressed={isFavorited}
                disabled={disabled}
                onClick={(e) => {
                    e.stopPropagation()
                    if (disabled) return
                    onToggle(name)
                }}
                className={cn(
                    'inline-flex items-center justify-center rounded transition-colors',
                    PADDING[size],
                    isFavorited
                        ? 'text-yellow-400 hover:text-yellow-300'
                        : 'text-foreground/30 hover:text-foreground/80',
                    disabled && 'opacity-40 cursor-not-allowed',
                    !disabled && 'cursor-pointer hover:bg-hairline/5',
                    className,
                )}
            >
                <Star
                    className={cn(SIZE_PX[size], 'transition-all')}
                    fill={isFavorited ? 'currentColor' : 'none'}
                    strokeWidth={2}
                />
            </button>
        </Tooltip>
    )
}
