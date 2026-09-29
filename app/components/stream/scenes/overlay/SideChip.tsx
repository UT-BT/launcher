import { cn } from '@/lib/utils'
import type { StreamSide } from '../../data/streamHotState'
import { sideToneClasses } from '../../sceneHelpers'

export function SideChip({ side, label }: { side: StreamSide; label: string }) {
    const tone = sideToneClasses(side)
    return (
        <span className={cn('inline-flex size-7 shrink-0 items-center justify-center rounded-md text-lg font-black italic leading-none', tone.solid, tone.onSolid)}>
            {label}
        </span>
    )
}
