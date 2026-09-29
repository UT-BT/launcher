import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MapThumbnail, type MapThumbnailSize } from '@/app/components/shared/MapThumbnail'
import { PICK_BAN_HUES, PICK_BAN_TONES, tint, type PickBanTone } from '@/app/components/broadcast/broadcastTone'
import { displayMapName } from '@/app/utils/format'

interface SceneMapTileProps {
    map: string | null
    number: number
    tone: PickBanTone
    decider: boolean
    size: number
    version?: string | null
    image?: MapThumbnailSize
    framed?: boolean
}

export function SceneMapTile({ map, number, tone, decider, size, version = null, image = 'card', framed = false }: SceneMapTileProps) {
    const hue = PICK_BAN_HUES[tone]
    const classes = PICK_BAN_TONES[tone]

    return (
        <div className="@container relative aspect-square shrink-0" style={{ width: size }}>
            <div
                className={cn('absolute inset-0 overflow-hidden bg-white/5', framed ? 'rounded-2xl border-4' : 'rounded-[6cqw]')}
                style={framed
                    ? { borderColor: hue, boxShadow: `0 0 40px ${tint(hue, 35)}, 0 18px 40px rgba(0,0,0,0.55)` }
                    : { boxShadow: `0 0 0 3px ${hue}, 0 0 28px ${tint(hue, 40)}, 0 10px 28px rgba(0,0,0,0.5)` }}
            >
                {map && (
                    <MapThumbnail mapName={map} version={version} size={image} alt="" className="absolute inset-0 size-full rounded-none border-0" />
                )}
                <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
                <span
                    className={cn(
                        'absolute left-[5cqw] top-[5cqw] flex items-center gap-[2cqw] rounded-[3cqw] px-[4cqw] py-[1.5cqw] text-[clamp(11px,9cqw,28px)] font-black italic uppercase leading-none shadow-lg',
                        classes.solid,
                        classes.onSolid,
                    )}
                >
                    {decider && <Star className="size-[1em] fill-current" />}
                    Map {number}
                </span>
                <p className="absolute inset-x-0 bottom-0 truncate px-[6cqw] pb-[5cqw] text-[clamp(11px,9cqw,28px)] font-bold uppercase leading-none tracking-wide">
                    {map ? displayMapName(map) : 'To be decided'}
                </p>
            </div>
        </div>
    )
}
