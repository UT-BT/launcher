import { cn } from '@/lib/utils'
import { PICK_BAN_TONES } from '@/app/components/broadcast/broadcastTone'
import type { SceneSideTag } from './sceneSideTags'

export function SceneSideTagChip({ tag, className }: { tag: SceneSideTag; className?: string }) {
    const tone = PICK_BAN_TONES[tag.tone]

    return (
        <span
            data-side-tag={tag.confirmed ? tag.label : 'tbc'}
            className={cn(
                'shrink-0 whitespace-nowrap rounded-md font-black italic uppercase leading-[1.1]',
                tag.confirmed ? cn('tracking-[0.16em]', tone.solid, tone.onSolid) : 'border-2 border-white/30 tracking-[0.08em] text-white/75',
                className,
            )}
        >
            {tag.label}
        </span>
    )
}
