import { Fragment } from 'react'
import { Ban, Check, Lock, Star, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { displayMapName } from '@/app/utils/format'
import type { PickBanStepAction } from '@/app/utils/api'
import type { PickBanSkippedBan, PickBanTimelineEntry } from '../pickBanView'
import { PICK_BAN_TONES, stepTone } from './pickBanTone'

interface StepTimelineProps {
    entries: PickBanTimelineEntry[]
    skippedBans: PickBanSkippedBan[]
    className?: string
}

const ACTION_ICON: Record<PickBanStepAction, LucideIcon> = {
    ban: Ban,
    pick: Check,
    decider: Star,
}

const SEGMENT_LABEL: Record<PickBanTimelineEntry['segment'], string> = {
    lettered: 'Sequence',
    ban_down: 'Ban-down',
    decider: 'Decider',
}

function entryLabel(entry: PickBanTimelineEntry): string {
    return entry.action === 'decider' ? 'Decider' : `${entry.actor} ${entry.action}`
}

function entryDescription(entry: PickBanTimelineEntry): string {
    const who = entry.action === 'decider' ? 'Decider, the last map standing' : entry.actionLabel
    const mapNumber = entry.mapNumber !== null && entry.action !== 'decider' ? ` map ${entry.mapNumber}` : ''
    const map = entry.map ? `: ${displayMapName(entry.map)}` : ''
    const status = entry.status === 'current' ? ' (now)' : entry.status === 'locked_in' ? ' (locked in)' : ''
    return `Step ${entry.number}, ${SEGMENT_LABEL[entry.segment].toLowerCase()}. ${who}${mapNumber}${map}${status}`
}

export function StepTimeline({ entries, skippedBans, className }: StepTimelineProps) {
    const trailing = skippedBans.filter(skipped => !entries.some(entry => entry.index === skipped.beforeIndex))

    return (
        <ol className={cn('flex flex-wrap items-start gap-x-1.5 gap-y-2', className)}>
            {entries.map((entry, position) => {
                const previous = entries[position - 1]
                return (
                    <Fragment key={entry.key}>
                        {skippedBans.filter(skipped => skipped.beforeIndex === entry.index).map(skipped => (
                            <SkippedChip key={skipped.key} skipped={skipped} />
                        ))}
                        {previous && previous.segment !== entry.segment && (
                            <li aria-hidden className="w-px self-stretch bg-hairline/10" />
                        )}
                        <TimelineChip entry={entry} />
                    </Fragment>
                )
            })}
            {trailing.map(skipped => (
                <SkippedChip key={skipped.key} skipped={skipped} />
            ))}
        </ol>
    )
}

function TimelineChip({ entry }: { entry: PickBanTimelineEntry }) {
    const tone = PICK_BAN_TONES[stepTone(entry.actor)]
    const Icon = entry.status === 'locked_in' ? Lock : ACTION_ICON[entry.action]
    const done = entry.status === 'revealed'
    const now = entry.status === 'current' || entry.status === 'locked_in'

    return (
        <li title={entryDescription(entry)} className="flex w-11 flex-col items-center gap-1">
            <span className="sr-only">{entryDescription(entry)}</span>
            <span
                aria-hidden
                className={cn(
                    'flex size-8 items-center justify-center rounded-lg border-2 bg-card/60',
                    tone.text,
                    tone.line,
                    done && tone.soft,
                    now && cn('ring-2 ring-offset-2 ring-offset-background', tone.border, tone.ring),
                    entry.status === 'upcoming' && 'opacity-40',
                )}
            >
                <Icon className="size-4" strokeWidth={2.5} />
            </span>
            <span
                aria-hidden
                className={cn(
                    'font-mono text-[9px] font-bold uppercase leading-none',
                    now ? tone.text : 'text-muted-foreground',
                    entry.status === 'upcoming' && 'opacity-60',
                )}
            >
                {entryLabel(entry)}
            </span>
        </li>
    )
}

function SkippedChip({ skipped }: { skipped: PickBanSkippedBan }) {
    const description = `Team ${skipped.actor} ban skipped: the eligible pool is too small for the full sequence`

    return (
        <li title={description} className="flex w-11 flex-col items-center gap-1">
            <span className="sr-only">{description}</span>
            <span aria-hidden className="flex size-8 items-center justify-center rounded-lg border-2 border-dashed border-hairline/20 text-muted-foreground/60">
                <Ban className="size-4" />
            </span>
            <span aria-hidden className="font-mono text-[9px] font-bold uppercase leading-none text-muted-foreground/60">
                Skipped
            </span>
        </li>
    )
}
