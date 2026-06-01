import { Heart, Star } from 'lucide-react'
import { Tooltip } from '@/app/components/ui/tooltip'
import type { PatreonTier } from '@/app/utils/patreon'

export const PATREON_EVENT = 'open-patreon'

/** Open the supporter info modal from anywhere. */
export function openPatreonInfo() {
    window.dispatchEvent(new CustomEvent(PATREON_EVENT))
}

const HEART_PX: Record<'sm' | 'md' | 'lg', number> = {
    sm: 11,
    md: 13,
    lg: 16,
}

const TIER_LABEL: Record<PatreonTier, string> = {
    1: 'Tier 1 Patreon Supporter',
    2: 'Tier 2 Patreon Supporter',
    3: 'Tier 3 Patreon Supporter',
}

export function PatreonBadge({ tier, size = 'md' }: { tier: PatreonTier; size?: 'sm' | 'md' | 'lg' }) {
    const px = HEART_PX[size]

    let heart: React.ReactNode
    if (tier === 1) {
        heart = <Heart style={{ width: px, height: px }} className="text-rose-400/70" />
    } else if (tier === 2) {
        heart = (
            <Heart
                style={{ width: px, height: px, filter: 'drop-shadow(0 0 3px rgba(251, 113, 133, 0.6))' }}
                className="fill-rose-400 text-rose-400"
            />
        )
    } else {
        heart = (
            <span className="relative inline-flex" style={{ animation: 'patreonPulse 1.8s ease-in-out infinite' }}>
                <Heart style={{ width: px, height: px }} className="fill-amber-300 text-amber-300" />
                <Star
                    style={{ width: px * 0.6, height: px * 0.6, top: -px * 0.28, right: -px * 0.34 }}
                    className="absolute fill-amber-200 text-amber-200"
                />
            </span>
        )
    }

    const open = (e: React.MouseEvent | React.KeyboardEvent) => {
        e.stopPropagation()
        openPatreonInfo()
    }
    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            open(e)
        }
    }

    return (
        <Tooltip content={`${TIER_LABEL[tier]}`} className="shrink-0">
            <span
                role="button"
                tabIndex={0}
                aria-label={`${TIER_LABEL[tier]}`}
                onClick={open}
                onKeyDown={onKeyDown}
                className="inline-flex items-center cursor-pointer hover:scale-110 transition-transform outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 rounded-sm"
            >
                {heart}
            </span>
        </Tooltip>
    )
}
