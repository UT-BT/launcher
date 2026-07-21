import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { teamAvatarUrl, type TeamCore } from '@/app/utils/api'

const SIZE_CLASS = {
    sm: 'size-9 rounded-lg text-xs',
    md: 'size-12 rounded-xl text-sm',
    lg: 'size-16 rounded-xl text-lg',
} as const

interface TeamAvatarProps {
    team: Pick<TeamCore, 'id' | 'name' | 'has_avatar' | 'avatar_updated'>
    size?: keyof typeof SIZE_CLASS
    className?: string
}

function initials(name: string): string {
    const words = name.split(/\s+/).filter(Boolean)
    if (words.length === 0) return '?'
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
    return (words[0][0] + words[1][0]).toUpperCase()
}

/**
 * A team crest, not a player avatar — PlayerInfo does not apply here.
 */
export function TeamAvatar({ team, size = 'md', className }: TeamAvatarProps) {
    const src = teamAvatarUrl(team)
    const [errored, setErrored] = useState(false)

    useEffect(() => setErrored(false), [src])

    return (
        <div
            className={cn(
                'shrink-0 overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center',
                'font-bold text-muted-foreground select-none',
                SIZE_CLASS[size],
                className,
            )}
        >
            {src && !errored ? (
                <img
                    src={src}
                    alt={team.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                    onError={() => setErrored(true)}
                />
            ) : (
                <span aria-hidden>{initials(team.name)}</span>
            )}
        </div>
    )
}
