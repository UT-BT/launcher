import { Fragment, useId } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { Ban, Check, Lock, Star, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { displayMapName } from '@/app/utils/format'
import type { PickBanStepAction } from '@/app/utils/api'
import type { PickBanSkippedBan, PickBanTimelineEntry } from '../pickBanView'
import { PICK_BAN_HUES, PICK_BAN_TONES, stepTone, tint } from './pickBanTone'
import { INDICATOR_TRANSITION, REVEAL_POP, REVEAL_RING_MOTION } from './stageMotion'

export type StepTrackSize = 'page' | 'broadcast'

interface StepTrackProps {
    entries: PickBanTimelineEntry[]
    skippedBans: PickBanSkippedBan[]
    size: StepTrackSize
    className?: string
}

const ACTION_ICON: Record<PickBanStepAction, LucideIcon> = {
    ban: Ban,
    pick: Check,
    decider: Star,
}

const ACTION_WORD: Record<PickBanStepAction, string> = {
    ban: 'Ban',
    pick: 'Pick',
    decider: 'Decider',
}

const SEGMENT_LABEL: Record<PickBanTimelineEntry['segment'], string> = {
    lettered: 'sequence',
    ban_down: 'bans',
    decider: 'decider',
}

const SLOT: Record<StepTrackSize, string> = {
    page: 'min-w-14 max-w-24 basis-14',
    broadcast: 'min-w-0 max-w-[128px]',
}

const LIST: Record<StepTrackSize, string> = {
    page: 'flex-wrap gap-x-2 gap-y-3 @xl/track:gap-x-3',
    broadcast: 'gap-3',
}

function slotDescription(entry: PickBanTimelineEntry): string {
    const who = entry.action === 'decider' ? 'Decider, the last map standing' : entry.actionLabel
    const mapNumber = entry.mapNumber !== null && entry.action !== 'decider' ? ` map ${entry.mapNumber}` : ''
    const map = entry.map ? `: ${displayMapName(entry.map)}` : ''
    const status = entry.status === 'current' ? ' (now)' : entry.status === 'locked_in' ? ' (locked in)' : ''
    const automatic = entry.automatic && entry.action !== 'decider' ? ', locked automatically' : ''
    return `Step ${entry.number}, ${SEGMENT_LABEL[entry.segment]}. ${who}${mapNumber}${map}${automatic}${status}`
}

export function StepTrack({ entries, skippedBans, size, className }: StepTrackProps) {
    const trailing = skippedBans.filter(skipped => !entries.some(entry => entry.index === skipped.beforeIndex))
    const trackId = useId()

    return (
        <LayoutGroup id={trackId}>
            <div className={cn('@container/track w-full', className)}>
                <ol className={cn('flex w-full items-start justify-center', LIST[size])}>
                    {entries.map((entry, position) => {
                        const previous = entries[position - 1]
                        return (
                            <Fragment key={entry.key}>
                                {skippedBans.filter(skipped => skipped.beforeIndex === entry.index).map(skipped => (
                                    <SkippedSlot key={skipped.key} skipped={skipped} size={size} />
                                ))}
                                {previous && previous.segment !== entry.segment && (
                                    <li aria-hidden className="mx-1 w-0.5 self-stretch rounded-full bg-hairline/15" />
                                )}
                                <TrackSlot entry={entry} size={size} />
                            </Fragment>
                        )
                    })}
                    {trailing.map(skipped => (
                        <SkippedSlot key={skipped.key} skipped={skipped} size={size} />
                    ))}
                </ol>
            </div>
        </LayoutGroup>
    )
}

function TrackSlot({ entry, size }: { entry: PickBanTimelineEntry; size: StepTrackSize }) {
    const toneKey = stepTone(entry.actor)
    const tone = PICK_BAN_TONES[toneKey]
    const hue = PICK_BAN_HUES[toneKey]
    const revealed = entry.status === 'revealed'
    const now = entry.status === 'current' || entry.status === 'locked_in'
    const Icon = entry.status === 'locked_in' ? Lock : ACTION_ICON[entry.action]
    const banned = entry.action === 'ban'

    return (
        <li title={slotDescription(entry)} className={cn('@container/slot flex-1', SLOT[size], entry.status === 'upcoming' && 'opacity-45')}>
            <span className="sr-only">{slotDescription(entry)}</span>
            <div className="flex flex-col gap-[7cqw]">
                <motion.div
                    aria-hidden
                    initial={false}
                    animate={entry.revealing ? REVEAL_POP : undefined}
                    className={cn('relative aspect-[8/7] w-full rounded-[10cqw] border-[3px] bg-hairline/5', revealed ? tone.border : tone.line)}
                    style={revealed && !banned ? { boxShadow: `0 0 18px ${tint(hue, 45)}` } : undefined}
                >
                    {now && (
                        <motion.span
                            layoutId="now"
                            transition={INDICATOR_TRANSITION}
                            className="absolute -inset-[6px] rounded-[calc(10cqw+6px)] border-[3px]"
                            style={{ borderColor: hue, boxShadow: `0 0 22px ${tint(hue, 70)}` }}
                        />
                    )}
                    <div className="absolute inset-0 overflow-hidden rounded-[calc(10cqw-3px)]">
                        {revealed && entry.map ? (
                            <>
                                <MapThumbnail
                                    mapName={entry.map}
                                    version={entry.screenshotVersion}
                                    size="card"
                                    alt=""
                                    className={cn('absolute inset-0 size-full rounded-none border-0', banned && 'grayscale brightness-[0.4]')}
                                />
                                {banned && (
                                    <span className={cn('absolute inset-0 flex items-center justify-center', tone.text)}>
                                        <Ban className="size-[36cqw] drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]" strokeWidth={2.75} />
                                    </span>
                                )}
                                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/90 to-transparent px-[6cqw] pb-[3cqw] pt-[14cqw] text-[clamp(9px,11.5cqw,15px)] font-bold uppercase leading-none text-white">
                                    {displayMapName(entry.map)}
                                </span>
                            </>
                        ) : (
                            <span className={cn('absolute inset-0 flex items-center justify-center', tone.text, !now && 'opacity-60')}>
                                <Icon className="size-[32cqw]" strokeWidth={2.5} />
                            </span>
                        )}
                    </div>
                    <AnimatePresence initial={false}>
                        {entry.revealing && revealed && (
                            <motion.span
                                key="reveal-ring"
                                {...REVEAL_RING_MOTION}
                                className="pointer-events-none absolute -inset-1 rounded-[calc(10cqw+4px)] border-[3px]"
                                style={{ borderColor: hue, boxShadow: `0 0 18px ${hue}` }}
                            />
                        )}
                    </AnimatePresence>
                </motion.div>
                <p aria-hidden className="truncate text-center font-pickban text-[clamp(11px,14cqw,18px)] font-black italic uppercase leading-none tracking-wide">
                    <span className={cn(now || revealed ? tone.text : 'text-muted-foreground')}>{ACTION_WORD[entry.action]}</span>
                    {entry.mapNumber !== null && entry.action !== 'decider' && <span className="text-muted-foreground"> · Map {entry.mapNumber}</span>}
                </p>
            </div>
        </li>
    )
}

function SkippedSlot({ skipped, size }: { skipped: PickBanSkippedBan; size: StepTrackSize }) {
    const description = `Team ${skipped.actor} ban skipped: the eligible pool is too small for the full sequence`

    return (
        <li title={description} className={cn('@container/slot flex-1 opacity-45', SLOT[size])}>
            <span className="sr-only">{description}</span>
            <div className="flex flex-col gap-[7cqw]">
                <div aria-hidden className="flex aspect-[8/7] w-full items-center justify-center rounded-[10cqw] border-[3px] border-dashed border-hairline/20 text-muted-foreground">
                    <Ban className="size-[30cqw]" />
                </div>
                <p aria-hidden className="text-center font-pickban text-[clamp(11px,14cqw,18px)] font-black italic uppercase leading-none tracking-wide text-muted-foreground">
                    Skipped
                </p>
            </div>
        </li>
    )
}
