import { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { ActiveTitle, getAvatarUrl } from '@/app/utils/api'

interface PlayerInfoProps {
    userId?: string | number
    alias?: string | null
    title?: ActiveTitle | null
    size?: 'sm' | 'md' | 'lg'
    layout?: 'horizontal' | 'vertical'
    highlight?: boolean
    showYouBadge?: boolean
    className?: string
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

function getReadableColor(r: number, g: number, b: number): string {
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    if (brightness < 100) {
        return `rgb(${Math.min(255, r + 80)}, ${Math.min(255, g + 80)}, ${Math.min(255, b + 80)})`
    }
    if (brightness > 200) {
        return `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)})`
    }
    return `rgb(${r}, ${g}, ${b})`
}

function getAvatarBorderStyle(title?: ActiveTitle | null): CSSProperties {
    const baseStyle: CSSProperties = {
        border: '1px solid rgba(255,255,255,0.15)',
    }
    if (!title || !title.rarity || title.rarity < 3) return baseStyle

    const { rarity, color_r, color_g, color_b } = title
    const titleColor = getReadableColor(color_r, color_g, color_b)

    switch (rarity) {
        case 3:
            return {
                border: `1px solid ${titleColor}`,
                boxShadow: `0 0 2px rgba(${color_r}, ${color_g}, ${color_b}, 0.15)`,
            }
        case 4:
            return {
                border: `1px solid ${titleColor}`,
                boxShadow: `0 0 3px rgba(${color_r}, ${color_g}, ${color_b}, 0.2)`,
            }
        case 5:
            return {
                border: `1px solid ${titleColor}`,
                boxShadow: `0 0 4px rgba(${color_r}, ${color_g}, ${color_b}, 0.3), 0 0 8px rgba(${color_r}, ${color_g}, ${color_b}, 0.15)`,
                animation: 'legendaryAvatarPulse 2s ease-in-out infinite',
            }
        default:
            return baseStyle
    }
}

function getTitleStyle(title?: ActiveTitle | null): CSSProperties {
    if (!title || !title.rarity) {
        return { color: '#6c757d' }
    }

    const { rarity, color_r, color_g, color_b } = title
    const titleColor = getReadableColor(color_r, color_g, color_b)
    const blackOutline =
        '0 0 1px rgba(0,0,0,1),' +
        '1px 0 1px rgba(0,0,0,1),' +
        '-1px 0 1px rgba(0,0,0,1),' +
        '0 1px 1px rgba(0,0,0,1),' +
        '0 -1px 1px rgba(0,0,0,1)'

    switch (rarity) {
        case 1:
            return { color: '#6c757d', fontWeight: 400 }
        case 2:
            return { color: titleColor, fontWeight: 500 }
        case 3:
            return {
                color: titleColor,
                fontWeight: 600,
                letterSpacing: '0.02em',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            }
        case 4:
            return {
                color: titleColor,
                fontWeight: 600,
                letterSpacing: '0.03em',
                textShadow: blackOutline,
            }
        case 5:
            return {
                color: titleColor,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textShadow: `${blackOutline}, 0 0 2px ${titleColor}`,
                animation: 'legendaryTitlePulse 2s ease-in-out infinite',
            }
        default:
            return { color: '#6c757d' }
    }
}

function PlayerAvatar({ userId, alias, title, sizePx }: {
    userId: string | number
    alias?: string | null
    title?: ActiveTitle | null
    sizePx: number
}) {
    const src = getAvatarUrl(userId)
    const fallback = `https://cdn.discordapp.com/embed/avatars/${Number(userId) % 5}.png`
    return (
        <img
            src={src}
            alt={alias || String(userId)}
            width={sizePx}
            height={sizePx}
            style={{
                width: sizePx,
                height: sizePx,
                objectFit: 'cover',
                ...getAvatarBorderStyle(title),
            }}
            className="rounded-full shrink-0"
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
    highlight, showYouBadge, className,
}: PlayerInfoProps) {
    const displayName = (alias && alias.trim()) || (userId != null ? String(userId) : 'Unknown')
    const titleStyle = getTitleStyle(title)
    const isAvatarable = isAvatarableUserId(userId)
    const sizePx = AVATAR_PX[size]

    const nameSizeClass = size === 'lg' ? 'text-base' : size === 'sm' ? 'text-xs' : 'text-sm'
    const titleSizeClass = size === 'lg' ? 'text-xs' : 'text-[11px]'

    const isClickable = isAvatarable
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
        layout === 'vertical' ? 'flex flex-col items-center gap-1.5' : 'flex items-center gap-2.5',
        'min-w-0',
        isClickable && 'cursor-pointer hover:opacity-80 transition-opacity',
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
                    highlight ? 'text-emerald-200' : 'text-white',
                    isClickable && 'hover:underline underline-offset-2',
                )}>
                    {displayName}
                </span>
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

    return (
        <div className={wrapperClass} {...interactiveProps}>
            {isAvatarable && (
                <PlayerAvatar userId={userId!} alias={alias} title={title} sizePx={sizePx} />
            )}
            {nameBlock}
        </div>
    )
}
