import { PICK_BAN_HUES, tint } from '@/app/components/broadcast/broadcastTone'
import { cn } from '@/lib/utils'
import type { StreamSide } from '../../data/streamHotState'
import { sideTone } from '../../sceneHelpers'
import { SEAM_RAIL, STAGE_WIDTH } from './overlayLayout'

export type SeamRailEdge = 'left' | 'right'

function lineGradient(side: StreamSide, edge: SeamRailEdge): string {
    const hue = PICK_BAN_HUES[sideTone(side)]
    const outward = edge === 'left' ? 'to left' : 'to right'
    const { gapPx, fadePx } = SEAM_RAIL

    return `linear-gradient(${outward}, transparent 0px, transparent ${gapPx}px, ${tint(hue, 55)} ${gapPx + fadePx * 0.35}px, ${hue} ${gapPx + fadePx}px, ${hue} 100%)`
}

export function OverlaySeamRail({ edge }: { edge: SeamRailEdge }) {
    return (
        <div
            aria-hidden
            data-overlay-part={`rail-${edge}`}
            className={cn('absolute flex flex-col', edge === 'left' ? 'right-full' : 'left-full')}
            style={{
                top: `calc(50% - ${SEAM_RAIL.thickness}px)`,
                height: SEAM_RAIL.thickness * 2,
                width: `calc(${STAGE_WIDTH / 2 + 1}px - 50%)`,
            }}
        >
            <div data-rail-side="a" style={{ height: SEAM_RAIL.thickness, background: lineGradient('a', edge) }} />
            <div data-rail-side="b" style={{ height: SEAM_RAIL.thickness, background: lineGradient('b', edge) }} />
        </div>
    )
}
