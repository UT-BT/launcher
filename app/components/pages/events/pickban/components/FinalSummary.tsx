import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { displayMapName } from '@/app/utils/format'
import type { PickBanSummaryEntry } from '../pickBanView'
import { PICK_BAN_TONES, stepTone } from './pickBanTone'
import { staggeredCard } from './stageMotion'

interface FinalSummaryProps {
    entries: PickBanSummaryEntry[]
    className?: string
}

function pickedByLabel(entry: PickBanSummaryEntry): string {
    return entry.decider ? entry.actorLabel : `${entry.actorLabel} pick`
}

export function FinalSummary({ entries, className }: FinalSummaryProps) {
    return (
        <ol
            className={cn('grid w-full justify-center gap-2 [--summary-card:11rem] @md/stage:gap-3 @[80rem]/stage:[--summary-card:16rem]', className)}
            style={{ gridTemplateColumns: `repeat(${entries.length}, minmax(0, var(--summary-card)))` }}
        >
            {entries.map((entry, order) => {
                const tone = PICK_BAN_TONES[stepTone(entry.decider ? null : entry.ab)]
                const name = entry.map ? displayMapName(entry.map) : null
                return (
                    <motion.li key={entry.key} variants={staggeredCard(order)} className="flex min-w-0 flex-col items-center gap-1.5">
                        <span className="sr-only">
                            {`Map ${entry.mapNumber}: ${name ?? 'to be decided'}, ${pickedByLabel(entry).toLowerCase()}`}
                        </span>
                        <div aria-hidden className={cn('relative aspect-square w-full overflow-hidden rounded-xl border-2 bg-hairline/5', tone.line, entry.decider && tone.border)}>
                            {entry.map && (
                                <MapThumbnail
                                    mapName={entry.map}
                                    version={entry.screenshotVersion}
                                    size="card"
                                    alt=""
                                    className="absolute inset-0 h-full w-full rounded-none border-0"
                                />
                            )}
                            <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                                Map {entry.mapNumber}
                            </span>
                        </div>
                        <span aria-hidden title={entry.map ?? undefined} className="w-full truncate text-center text-xs font-semibold text-foreground">
                            {name ?? 'To be decided'}
                        </span>
                        <span aria-hidden className={cn('line-clamp-2 w-full break-words text-center text-[10px] font-bold uppercase leading-tight tracking-wider', tone.text)}>
                            {pickedByLabel(entry)}
                        </span>
                    </motion.li>
                )
            })}
        </ol>
    )
}
