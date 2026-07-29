import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ActiveTitle, avatarSizeFor, getAvatarUrl } from '@/app/utils/api'
import { getAvatarBorderStyle, getTitleTextStyle } from '@/app/utils/titleStyles'
import { useTheme } from '@/app/theme/ThemeProvider'
import { usePatreonTier } from '@/app/utils/patreon'
import { PatreonBadge } from '@/app/components/shared/PatreonBadge'

interface PlayerInfoProps {
    userId?: string | number
    alias?: string | null
    title?: ActiveTitle | null
    size?: 'sm' | 'md' | 'lg'
    layout?: 'horizontal' | 'vertical'
    highlight?: boolean
    showYouBadge?: boolean
    className?: string
    interactive?: boolean
    presentation?: 'full' | 'avatar'
}

const AVATAR_PX: Record<NonNullable<PlayerInfoProps['size']>, number> = {
    sm: 24,
    md: 32,
    lg: 48,
}

function isAvatarableUserId(userId?: string | number): userId is string | number {
    if (userId == null) return false
    return String(userId).length > 5
}

export function PlayerAvatar({ userId, alias, title, sizePx, isLight, priority = false, className }: {
    userId: string | number
    alias?: string | null
    title?: ActiveTitle | null
    sizePx: number
    isLight: boolean
    priority?: boolean
    className?: string
}) {
    const src = getAvatarUrl(userId, avatarSizeFor(sizePx))
    const fallback = `https://cdn.discordapp.com/embed/avatars/${Number(userId) % 5}.png`
    const borderStyle = useMemo(() => getAvatarBorderStyle(title, isLight), [title, isLight])
    return (
        <img
            src={src}
            alt={alias || String(userId)}
            width={sizePx}
            height={sizePx}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            decoding="async"
            style={{
                width: sizePx,
                height: sizePx,
                objectFit: 'cover',
                ...borderStyle,
            }}
            className={cn('rounded-full shrink-0', className)}
            onError={e => { (e.target as HTMLImageElement).src = fallback }}
        />
    )
}

function openPlayer(userId: string | number) {
    window.dispatchEvent(new CustomEvent('open-player', { detail: { userId } }))
}

export function PlayerInfo({
    userId, alias, title,
    size = 'md', layout = 'horizontal',
    highlight, showYouBadge, className, interactive = true, presentation = 'full',
}: PlayerInfoProps) {
    const { themeId } = useTheme()
    const isLight = themeId === 'light'
    const displayName = (alias && alias.trim()) || (userId != null ? String(userId) : 'Unknown')
    const titleStyle = useMemo(() => getTitleTextStyle(title, isLight), [title, isLight])
    const isAvatarable = isAvatarableUserId(userId)
    const sizePx = AVATAR_PX[size]
    const patreonTier = usePatreonTier(userId)

    const nameSizeClass = size === 'lg' ? 'text-base' : size === 'sm' ? 'text-xs' : 'text-sm'
    const titleSizeClass = size === 'lg' ? 'text-xs' : 'text-[11px]'

    const isClickable = isAvatarable && interactive
    const handleClick = (e: React.MouseEvent) => {
        if (!isClickable) return
        e.stopPropagation()
        openPlayer(userId!)
    }
    const onKeyDown = (e: React.KeyboardEvent) => {
        if (!isClickable) return
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            openPlayer(userId!)
        }
    }

    const wrapperClass = cn(
        presentation === 'avatar'
            ? 'inline-flex items-center'
            : layout === 'vertical'
                ? 'flex flex-col items-center gap-1.5'
                : 'flex items-center gap-2.5',
        'min-w-0',
        isClickable && 'w-fit max-w-full cursor-pointer hover:opacity-80 transition-opacity',
        className,
    )

    const interactiveProps = isClickable
        ? { role: 'button', tabIndex: 0, onClick: handleClick, onKeyDown }
        : {}

    const nameBlock = (
        <div className={cn('flex flex-col min-w-0 leading-tight', layout === 'vertical' && 'items-center')}>
            <div className="flex items-center gap-1.5">
                <span className={cn(
                    'font-semibold truncate',
                    nameSizeClass,
                    highlight ? 'text-emerald-200' : 'text-foreground',
                    isClickable && 'hover:underline underline-offset-2',
                )}>
                    {displayName}
                </span>
                {patreonTier !== 0 && <PatreonBadge tier={patreonTier} size={size} />}
                {showYouBadge && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        You
                    </span>
                )}
            </div>
            {title && (
                <span className={cn(titleSizeClass, 'truncate', layout === 'vertical' && 'leading-tight')} style={titleStyle}>
                    {title.name}
                </span>
            )}
        </div>
    )

    if (presentation === 'avatar') {
        return (
            <div
                className={cn(wrapperClass, highlight && 'rounded-full ring-1 ring-emerald-400/70')}
                aria-label={displayName}
                {...interactiveProps}
            >
                {isAvatarable ? (
                    <PlayerAvatar userId={userId!} alias={alias} title={title} sizePx={sizePx} isLight={isLight} />
                ) : (
                    <span
                        className="inline-flex items-center justify-center rounded-full bg-hairline/10 border border-hairline/10 text-[9px] font-bold text-foreground uppercase"
                        style={{ width: sizePx, height: sizePx }}
                    >
                        {displayName.slice(0, 1)}
                    </span>
                )}
            </div>
        )
    }

    return (
        <div className={wrapperClass} {...interactiveProps}>
            {isAvatarable && (
                <PlayerAvatar userId={userId!} alias={alias} title={title} sizePx={sizePx} isLight={isLight} />
            )}
            {nameBlock}
        </div>
    )
}
