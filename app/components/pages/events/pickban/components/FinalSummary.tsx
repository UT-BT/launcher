import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { displayMapName } from '@/app/utils/format'
import type { PickBanSummaryEntry } from '../pickBanView'
import { PICK_BAN_HUES, PICK_BAN_TONES, stepTone, tint } from './pickBanTone'
import { staggeredCard } from './stageMotion'

interface FinalSummaryProps {
    entries: PickBanSummaryEntry[]
    className?: string
}

function pickedByLabel(entry: PickBanSummaryEntry): string {
    return entry.decider ? entry.actorLabel : `Picked by ${entry.actorLabel}`
}

export function FinalSummary({ entries, className }: FinalSummaryProps) {
    return (
        <ol
            className={cn('grid w-full justify-center gap-2 [--summary-card:11rem] @md/stage:gap-4 @[80rem]/stage:[--summary-card:15rem]', className)}
            style={{ gridTemplateColumns: `repeat(${entries.length}, minmax(0, var(--summary-card)))` }}
        >
            {entries.map((entry, order) => {
                const toneKey = stepTone(entry.decider ? null : entry.ab)
                const tone = PICK_BAN_TONES[toneKey]
                const hue = PICK_BAN_HUES[toneKey]
                const name = entry.map ? displayMapName(entry.map) : null
                return (
                    <motion.li key={entry.key} variants={staggeredCard(order)} className="@container/summary min-w-0">
                        <span className="sr-only">
                            {`Map ${entry.mapNumber}: ${name ?? 'To be decided'}, ${entry.decider ? 'decider' : `picked by ${entry.actorLabel}`}`}
                        </span>
                        <div aria-hidden className="flex flex-col items-center gap-[5cqw]">
                            <div
                                className={cn('relative aspect-square w-full overflow-hidden rounded-[7cqw] border-[3px] bg-hairline/5', entry.map ? tone.border : tone.line)}
                                style={entry.map ? { boxShadow: `0 0 24px ${tint(hue, 35)}` } : undefined}
                            >
                                {entry.map && (
                                    <MapThumbnail
                                        mapName={entry.map}
                                        version={entry.screenshotVersion}
                                        size="card"
                                        alt=""
                                        className="absolute inset-0 h-full w-full rounded-none border-0"
                                    />
                                )}
                                <span
                                    className={cn(
                                        'absolute left-[5cqw] top-[5cqw] flex items-center gap-[2cqw] rounded-[3cqw] px-[4cqw] py-[1.5cqw] font-pickban text-[clamp(10px,10cqw,26px)] font-black italic uppercase leading-none shadow-lg',
                                        tone.solid,
                                        tone.onSolid,
                                    )}
                                >
                                    {entry.decider && <Star className="size-[1em] fill-current" />}
                                    Map {entry.mapNumber}
                                </span>
                            </div>
                            <span title={entry.map ?? undefined} className="w-full truncate text-center font-pickban text-[clamp(11px,11cqw,28px)] font-bold uppercase leading-none text-foreground">
                                {name ?? 'To be decided'}
                            </span>
                            <span className={cn('line-clamp-2 w-full break-words text-center font-pickban text-[clamp(9px,7.5cqw,18px)] font-bold uppercase leading-tight tracking-wider', tone.text)}>
                                {pickedByLabel(entry)}
                            </span>
                        </div>
                    </motion.li>
                )
            })}
        </ol>
    )
}
