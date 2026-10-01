import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { PICK_BAN_HUES, tint } from '@/app/components/broadcast/broadcastTone'
import { sideTone } from '../../sceneHelpers'
import { NAME_TAG, SEAM_Y } from './overlayLayout'
import type { OverlayTag, OverlayTagPlacement } from './overlayView'

const PLACEMENT: Record<OverlayTagPlacement, CSSProperties> = {
    'above-seam-left': { left: 0, top: SEAM_Y - NAME_TAG.height },
    'above-seam-right': { right: 0, top: SEAM_Y - NAME_TAG.height },
    'below-seam-left': { left: 0, top: SEAM_Y },
    'below-seam-right': { right: 0, top: SEAM_Y },
}

export function OverlayNameTag({ tag }: { tag: OverlayTag }) {
    const right = tag.placement.endsWith('right')
    const above = tag.placement.startsWith('above')
    const hue = PICK_BAN_HUES[sideTone(tag.side)]
    const inward = right ? 'to left' : 'to right'
    const offSeam = above ? 'to top' : 'to bottom'
    const fadeInward = `linear-gradient(${inward}, #000 0%, #000 35%, transparent 100%)`
    const fadeOffSeam = `linear-gradient(${offSeam}, #000 0%, #000 45%, transparent 100%)`

    return (
        <div
            data-overlay-part={`tag-${tag.slot}`}
            className="absolute"
            style={{ ...PLACEMENT[tag.placement], width: NAME_TAG.width, height: NAME_TAG.height }}
        >
            <div aria-hidden className="absolute inset-0" style={{ maskImage: fadeInward, WebkitMaskImage: fadeInward }}>
                <div
                    className="absolute inset-0 bg-[#05070c]/72"
                    style={{ maskImage: fadeOffSeam, WebkitMaskImage: fadeOffSeam }}
                />
                <div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(${offSeam}, ${tint(hue, 46)} 0%, ${tint(hue, 14)} 45%, transparent 85%)` }}
                />
            </div>
            <div className={cn('relative flex h-full min-w-0 items-center', right ? 'flex-row-reverse pl-11 pr-[18px]' : 'pl-[18px] pr-11')}>
                <div className="min-w-0 font-sans [zoom:1.6] [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">
                    <PlayerInfo
                        userId={tag.userId ?? undefined}
                        alias={tag.name}
                        size="sm"
                        interactive={false}
                        className={cn(right && 'flex-row-reverse text-right')}
                    />
                </div>
            </div>
        </div>
    )
}
