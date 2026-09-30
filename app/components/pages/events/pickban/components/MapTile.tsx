import { AnimatePresence, motion } from 'framer-motion'
import { Ban, Check, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MapThumbnail, type MapThumbnailSize } from '@/app/components/shared/MapThumbnail'
import { displayMapName } from '@/app/utils/format'
import type { PickBanActor } from '@/app/utils/api'
import type { PickBanCardView } from '../pickBanView'
import { PICK_BAN_HUES, PICK_BAN_TONES, stepTone, teamTone, tint } from './pickBanTone'
import { CHIP_MOTION, REVEAL_FLASH_MOTION, REVEAL_POP, STAMP_MOTION } from './stageMotion'

export type ActorLabels = Record<PickBanActor, string>

interface MapTileProps {
    card: PickBanCardView
    previewActor: PickBanActor | null
    actorLabels: ActorLabels
    dimmed: boolean
    imageSize: MapThumbnailSize
    onSelect?: (map: string) => void
}

const BADGE = 'absolute left-[5cqw] top-[5cqw] flex items-center gap-[2cqw] rounded-[3cqw] px-[4cqw] py-[1.5cqw] text-[clamp(11px,9cqw,28px)] font-black italic uppercase leading-none shadow-lg'

const WIDE_BADGE = 'absolute inset-x-[5cqw] top-[5cqw] rounded-[3cqw] py-[1.5cqw] text-center text-[clamp(10px,7.5cqw,22px)] font-black italic uppercase leading-none tracking-wider shadow-lg'

export function actorLabelsOf(left: { ab: PickBanActor | null; name: string } | null, right: { ab: PickBanActor | null; name: string } | null): ActorLabels {
    const labels: ActorLabels = { A: 'Team A', B: 'Team B' }
    for (const panel of [left, right]) {
        if (panel?.ab) labels[panel.ab] = panel.name
    }
    return labels
}

function tileLabel(card: PickBanCardView, name: string, actorLabels: ActorLabels): string {
    const by = card.ab ? actorLabels[card.ab] : ''
    switch (card.state) {
        case 'banned':
            return `${name}, banned by ${by} at step ${card.stepNumber}`
        case 'picked':
            return `${name}, map ${card.mapNumber}, picked by ${by}`
        case 'decider':
            return `${name}, the decider, map ${card.mapNumber}`
        default:
            return card.previewed ? `${name}, being considered` : name
    }
}

function bylineOf(card: PickBanCardView, actorLabels: ActorLabels): string | null {
    const by = card.ab ? actorLabels[card.ab] : null
    if (card.state === 'decider') return 'Decider'
    if (card.state === 'banned') return `By ${by}`
    if (card.state === 'picked') return `Picked by ${by}`
    return null
}

export function MapTile({ card, previewActor, actorLabels, dimmed, imageSize, onSelect }: MapTileProps) {
    const name = displayMapName(card.map)
    const toneKey = stepTone(card.state === 'decider' ? null : card.ab)
    const tone = PICK_BAN_TONES[toneKey]
    const hue = PICK_BAN_HUES[toneKey]
    const focusToneKey = teamTone(previewActor)
    const focusHue = PICK_BAN_HUES[focusToneKey]
    const focusTone = PICK_BAN_TONES[focusToneKey]
    const banned = card.state === 'banned'
    const chosen = card.state === 'picked' || card.state === 'decider'
    const acted = banned || chosen
    const choosable = onSelect !== undefined && card.selectable
    const raised = card.previewed || card.selected
    const byline = bylineOf(card, actorLabels)

    return (
        <motion.div
            initial={false}
            animate={card.revealing ? REVEAL_POP : { scale: raised ? 1.04 : 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            title={card.map}
            className={cn('group/tile @container/tile relative size-full', (raised || card.revealing) && 'z-10')}
        >
            <span className="sr-only">{tileLabel(card, name, actorLabels)}</span>
            <div
                aria-hidden
                className={cn(
                    'relative size-full overflow-hidden rounded-[6cqw] bg-hairline/5 shadow-[0_10px_28px_rgba(0,0,0,0.5)] transition-[box-shadow] duration-300',
                    choosable && !raised && 'group-hover/tile:shadow-[0_0_0_2px_rgba(255,255,255,0.55),0_14px_32px_rgba(0,0,0,0.6)]',
                )}
                style={raised
                    ? { boxShadow: `0 0 0 ${card.selected ? 4 : 3}px ${focusHue}, 0 0 36px 4px ${tint(focusHue, 55)}, 0 16px 36px rgba(0,0,0,0.6)` }
                    : chosen
                        ? { boxShadow: `0 0 0 3px ${hue}, 0 0 28px ${tint(hue, 40)}, 0 10px 28px rgba(0,0,0,0.5)` }
                        : undefined}
            >
                <MapThumbnail
                    mapName={card.map}
                    version={card.screenshotVersion}
                    size={imageSize}
                    alt=""
                    className={cn(
                        'absolute inset-0 size-full rounded-none border-0 transition-[filter,opacity,transform] duration-500',
                        banned && 'grayscale brightness-[0.32]',
                        dimmed && 'brightness-[0.55] saturate-[0.7]',
                        choosable && 'group-hover/tile:scale-[1.04] group-hover/tile:brightness-100 group-hover/tile:saturate-100',
                    )}
                />
                <div className="pointer-events-none absolute inset-0 rounded-[6cqw] ring-1 ring-inset ring-white/10" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
                <AnimatePresence initial={false}>
                    {card.revealing && acted && (
                        <motion.span
                            key="reveal-flash"
                            {...REVEAL_FLASH_MOTION}
                            className="pointer-events-none absolute inset-0"
                            style={{ background: `radial-gradient(circle, color-mix(in srgb, ${hue} 70%, white) 0%, ${tint(hue, 45)} 70%)` }}
                        />
                    )}
                    {banned && (
                        <motion.div key="banned" {...STAMP_MOTION} className="absolute inset-0 flex flex-col items-center justify-center gap-[2cqw] pb-[14cqw]">
                            <span className={cn('flex size-[26cqw] items-center justify-center rounded-full border-[1.5cqw] bg-black/40', tone.border, tone.text)}>
                                <Ban className="size-[15cqw]" strokeWidth={2.75} />
                            </span>
                            <span className={cn('text-[clamp(11px,12cqw,34px)] font-black italic uppercase leading-none tracking-[0.12em]', tone.text)}>Banned</span>
                        </motion.div>
                    )}
                    {chosen && (
                        <motion.span key="map-number" {...CHIP_MOTION} className={cn(BADGE, tone.solid, tone.onSolid)}>
                            {card.state === 'decider' && <Star className="size-[1em] fill-current" />}
                            Map {card.mapNumber}
                        </motion.span>
                    )}
                    {card.lockedIn ? (
                        <motion.span key="locked-in" {...CHIP_MOTION} className={cn(WIDE_BADGE, 'bg-emerald-500 text-white')}>
                            Locked In
                        </motion.span>
                    ) : card.selected ? (
                        <motion.span key="selected" {...CHIP_MOTION} className={cn(WIDE_BADGE, focusTone.solid, focusTone.onSolid)}>
                            <Check className="-mt-[0.15em] mr-[0.2em] inline size-[1em]" strokeWidth={3.5} />
                            Selected
                        </motion.span>
                    ) : card.previewed ? (
                        <motion.span key="considering" {...CHIP_MOTION} className={cn(WIDE_BADGE, focusTone.solid, focusTone.onSolid)}>
                            Considering
                        </motion.span>
                    ) : null}
                </AnimatePresence>
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-[1cqw] px-[6cqw] pb-[5cqw]">
                    <p
                        className={cn(
                            'truncate text-[clamp(11px,9cqw,28px)] font-bold uppercase leading-none tracking-wide text-white',
                            banned && 'text-white/55',
                        )}
                    >
                        {name}
                    </p>
                    {byline && (
                        <p className={cn('truncate text-[clamp(9px,6.2cqw,18px)] font-bold uppercase leading-tight tracking-wider', tone.text)}>{byline}</p>
                    )}
                </div>
            </div>
            {choosable && (
                <button
                    type="button"
                    aria-pressed={card.selected}
                    aria-label={`Select ${name}`}
                    onClick={() => onSelect(card.map)}
                    className="absolute inset-0 cursor-pointer rounded-[6cqw] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
                />
            )}
        </motion.div>
    )
}
