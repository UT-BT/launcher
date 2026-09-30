import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { PICK_BAN_HUES, tint } from '@/app/components/broadcast/broadcastTone'
import { sideTone, sideToneClasses } from '../../sceneHelpers'
import { NAME_TAG } from './overlayLayout'
import type { OverlayCorner, OverlayTag } from './overlayView'

const PLACEMENT: Record<OverlayCorner, string> = {
    'mid-left': 'left-0 top-[466px]',
    'mid-right': 'right-0 top-[466px]',
    'bottom-left': 'bottom-7 left-0',
    'bottom-right': 'bottom-7 right-0',
}

const CLIP = {
    left: 'polygon(0 0, 100% 0, calc(100% - 50px) 100%, 0 100%)',
    right: 'polygon(0 0, 100% 0, 100% 100%, 50px 100%)',
}

export function OverlayNameTag({ tag }: { tag: OverlayTag }) {
    const right = tag.corner.endsWith('right')
    const hue = PICK_BAN_HUES[sideTone(tag.side)]
    const direction = right ? 'to left' : 'to right'

    return (
        <div
            data-overlay-part={`tag-${tag.slot}`}
            className={cn('absolute', PLACEMENT[tag.corner])}
            style={{
                width: NAME_TAG.width,
                height: NAME_TAG.height,
                clipPath: right ? CLIP.right : CLIP.left,
                background: `linear-gradient(${direction}, rgba(5, 7, 12, 0.82), rgba(5, 7, 12, 0.55) 70%, transparent)`,
            }}
        >
            <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(${direction}, ${tint(hue, 34)}, ${tint(hue, 12)} 55%, ${tint(hue, 4)})` }} />
            <div aria-hidden className={cn('absolute inset-y-0 w-2', right ? 'right-0' : 'left-0', sideToneClasses(tag.side).solid)} />
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(${direction}, ${hue}, transparent 85%)` }} />
            <div className={cn('relative flex h-full min-w-0 items-center', right ? 'flex-row-reverse pl-[60px] pr-6' : 'pl-6 pr-[60px]')}>
                <div className="min-w-0 font-sans [zoom:1.75]">
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
