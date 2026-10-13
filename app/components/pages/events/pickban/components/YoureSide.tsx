import { cn } from '@/lib/utils'
import type { SideColor } from '@/app/utils/api'
import { sideColorName, sideColorTone, youreSideLabel } from '@/app/utils/sideLabels'
import { PICK_BAN_TONES } from '@/app/components/broadcast/broadcastTone'

export function YoureSide({ color, className }: { color: SideColor; className?: string }) {
    const tone = PICK_BAN_TONES[sideColorTone(color)]

    return (
        <span
            title={youreSideLabel(color) ?? undefined}
            className={cn('inline-flex w-fit shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-foreground', tone.line, tone.soft, className)}
        >
            You’re <strong className={cn('font-bold', tone.text)}>{sideColorName(color)}</strong>
        </span>
    )
}
