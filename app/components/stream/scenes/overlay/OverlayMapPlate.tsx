import { cn } from '@/lib/utils'
import { PICK_BAN_TONES } from '@/app/components/broadcast/broadcastTone'
import { sideToneClasses } from '../../sceneHelpers'
import type { OverlayView } from './overlayView'

export function OverlayMapPlate({ view }: { view: OverlayView }) {
    const { map } = view

    return (
        <div
            data-overlay-part="map"
            className="absolute bottom-0 left-1/2 w-[700px] -translate-x-1/2 rounded-t-[14px] bg-[#05070c]/84 px-7 pb-3.5 pt-3 text-center shadow-[0_0_0_1px_rgba(255,255,255,0.1)]"
        >
            {map && (
                <p className="flex min-w-0 items-center justify-center gap-3.5">
                    <span className="min-w-0 truncate text-[32px] font-black italic uppercase">{map.name}</span>
                    <span className={cn('shrink-0 text-xl font-bold uppercase tracking-[0.14em]', map.pickedBy ? sideToneClasses(map.pickedBy.side).text : PICK_BAN_TONES.gold.text)}>
                        {map.pickedBy ? `Picked by ${map.pickedBy.team}` : 'Decider'}
                    </span>
                </p>
            )}
            <p className={cn('text-[17px] font-bold uppercase tracking-[0.16em] text-white/60', map && 'mt-1')}>{view.footer}</p>
        </div>
    )
}
