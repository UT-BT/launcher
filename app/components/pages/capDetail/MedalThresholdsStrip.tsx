import { cn } from '@/lib/utils'
import { formatCapTime } from '@/app/utils/format'
import { medalIconForInt, formatSignedDelta } from './capStats'
import type { CapDeltas, CapMedalThresholds } from '@/app/utils/api'

interface MedalThresholdsStripProps {
    medals: CapMedalThresholds
    deltas: CapDeltas
}

const TIERS: { deltaKey: keyof CapDeltas; medalKey: keyof CapMedalThresholds; medalInt: number; label: string }[] = [
    { deltaKey: 'wr', medalKey: 'world_record', medalInt: 6, label: 'World Record' },
    { deltaKey: 'champion', medalKey: 'champion', medalInt: 5, label: 'Champion' },
    { deltaKey: 'gold', medalKey: 'gold', medalInt: 4, label: 'Gold' },
    { deltaKey: 'silver', medalKey: 'silver', medalInt: 3, label: 'Silver' },
    { deltaKey: 'bronze', medalKey: 'bronze', medalInt: 2, label: 'Bronze' },
]

function Chip({ icon, label, threshold, delta }: {
    icon: string | null
    label: string
    threshold: number | null
    delta: number | null
}) {
    if (threshold == null) return null
    const met = delta != null && delta <= 0
    return (
        <div className="bg-hairline/[0.02] border border-hairline/5 rounded-lg px-2 py-2.5 flex flex-col items-center text-center gap-1 h-full">
            {icon && <img src={icon} alt={label} className="size-5 object-contain" />}
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate max-w-full">{label}</div>
            <div className="text-sm font-mono tabular-nums text-foreground">{formatCapTime(threshold)}</div>
            <div className={cn(
                'text-xs font-mono tabular-nums font-semibold',
                met ? 'text-emerald-300' : 'text-red-300',
            )}>
                {met ? '✓ earned' : formatSignedDelta(delta)}
            </div>
        </div>
    )
}

export function MedalThresholdsStrip({ medals, deltas }: MedalThresholdsStripProps) {
    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl shrink-0">
            <div className="px-4 py-3 border-b border-hairline/5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium text-center">
                Medal Thresholds
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-stretch">
                {TIERS.map(t => (
                    <Chip
                        key={t.deltaKey}
                        icon={medalIconForInt(t.medalInt)}
                        label={t.label}
                        threshold={medals[t.medalKey]}
                        delta={deltas[t.deltaKey]}
                    />
                ))}
            </div>
        </div>
    )
}
