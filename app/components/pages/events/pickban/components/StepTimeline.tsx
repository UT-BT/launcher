import { Fragment, useId } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { Ban, Check, Lock, Star, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { displayMapName } from '@/app/utils/format'
import type { PickBanStepAction } from '@/app/utils/api'
import type { PickBanSkippedBan, PickBanTimelineEntry } from '../pickBanView'
import { PICK_BAN_HUES, PICK_BAN_TONES, stepTone } from './pickBanTone'
import { INDICATOR_TRANSITION, REVEAL_POP, REVEAL_RING_MOTION } from './stageMotion'

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
    ban_down: 'Bans',
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
    const automatic = entry.automatic && entry.action !== 'decider' ? ', locked automatically' : ''
    return `Step ${entry.number}, ${SEGMENT_LABEL[entry.segment].toLowerCase()}. ${who}${mapNumber}${map}${automatic}${status}`
}

export function StepTimeline({ entries, skippedBans, className }: StepTimelineProps) {
    const trailing = skippedBans.filter(skipped => !entries.some(entry => entry.index === skipped.beforeIndex))
    const timelineId = useId()

    return (
        <LayoutGroup id={timelineId}>
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
        </LayoutGroup>
    )
}

function TimelineChip({ entry }: { entry: PickBanTimelineEntry }) {
    const toneKey = stepTone(entry.actor)
    const tone = PICK_BAN_TONES[toneKey]
    const hue = PICK_BAN_HUES[toneKey]
    const Icon = entry.status === 'locked_in' ? Lock : ACTION_ICON[entry.action]
    const done = entry.status === 'revealed'
    const now = entry.status === 'current' || entry.status === 'locked_in'

    return (
        <li title={entryDescription(entry)} className="flex w-11 flex-col items-center gap-1">
            <span className="sr-only">{entryDescription(entry)}</span>
            <motion.span
                aria-hidden
                initial={false}
                animate={entry.revealing ? REVEAL_POP : undefined}
                className={cn(
                    'relative flex size-8 items-center justify-center rounded-lg border-2 bg-card/60 transition-[background-color,border-color,opacity] duration-300',
                    tone.text,
                    tone.line,
                    done && tone.soft,
                    now && tone.border,
                    entry.status === 'upcoming' && 'opacity-40',
                )}
            >
                {now && (
                    <motion.span
                        layoutId="now"
                        transition={INDICATOR_TRANSITION}
                        className={cn('absolute -inset-1 rounded-[10px] ring-2 transition-[box-shadow] duration-300', tone.ring)}
                    />
                )}
                <AnimatePresence initial={false}>
                    {entry.revealing && done && (
                        <motion.span
                            key="reveal-ring"
                            {...REVEAL_RING_MOTION}
                            className="pointer-events-none absolute -inset-1 rounded-[10px] border-2"
                            style={{ borderColor: hue, boxShadow: `0 0 14px ${hue}` }}
                        />
                    )}
                </AnimatePresence>
                <Icon className="size-4" strokeWidth={2.5} />
            </motion.span>
            <span
                aria-hidden
                className={cn(
                    'font-mono text-[9px] font-bold uppercase leading-none transition-[color,opacity] duration-300',
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
