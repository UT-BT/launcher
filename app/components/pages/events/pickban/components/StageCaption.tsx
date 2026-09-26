import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PickBanCardView, PickBanTurn, PickBanView } from '../pickBanView'
import { PICK_BAN_HUES, PICK_BAN_TONES, stepTone, tint } from './pickBanTone'

const CHEVRONS = [0, 1, 2]

const KICKER = 'flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground @xl/arena:text-xs'

const TITLE = 'font-pickban text-3xl font-black italic uppercase leading-none tracking-tight @xl/arena:text-4xl @5xl/arena:text-5xl'

const DETAIL = 'text-xs text-muted-foreground @xl/arena:text-sm'

const PAGE_CHEVRONS = 'hidden -space-x-3 @xl/arena:flex @xl/arena:-space-x-4'

const PAGE_CHEVRON_ICON = 'size-8 @5xl/arena:size-10'

export function StageCaption({ view }: { view: PickBanView }) {
    return (
        <div className="flex min-h-24 flex-col items-center justify-center gap-1.5 text-center @xl/arena:min-h-28">
            <CaptionContent view={view} />
        </div>
    )
}

function CaptionContent({ view }: { view: PickBanView }) {
    switch (view.stagePhase) {
        case 'none':
            return (
                <Notice
                    kicker={<><CalendarClock className="size-3.5" /> Picks &amp; Bans</>}
                    title="Not open yet"
                    detail="The lobby opens on match day. The teams, maps and steps here are a preview."
                />
            )
        case 'lobby':
            return <Notice kicker="Lobby open" title="Waiting for an admin to start" />
        case 'intro':
        case 'awaiting':
        case 'spotlight':
            return view.turn
                ? <TurnCaption turn={view.turn} stepCount={view.timeline.length} mapCount={view.summary.length} previewCard={view.cards.find(card => card.previewed) ?? null} />
                : null
        default:
            return null
    }
}

function Notice({ kicker, title, detail }: { kicker: ReactNode; title: string; detail?: string }) {
    return (
        <>
            <p className={KICKER}>{kicker}</p>
            <h2 className={cn(TITLE, 'text-foreground')}>{title}</h2>
            {detail && <p className={DETAIL}>{detail}</p>}
        </>
    )
}

function turnDetail(turn: PickBanTurn, previewCard: PickBanCardView | null): string {
    if (turn.lockedIn) return 'Locked in, revealing now!'
    if (turn.viewerActs) return 'Your turn: select a map, then lock in'
    if (previewCard) return `${turn.actorLabel} is considering this map…`
    return `Waiting for ${turn.actorLabel} to lock in`
}

function TurnCaption({ turn, stepCount, mapCount, previewCard }: {
    turn: PickBanTurn
    stepCount: number
    mapCount: number
    previewCard: PickBanCardView | null
}) {
    const toneKey = stepTone(turn.ab)
    const tone = PICK_BAN_TONES[toneKey]
    const hue = PICK_BAN_HUES[toneKey]
    const towardsLeft = turn.ab === 'A'

    return (
        <>
            <p className={KICKER}>
                Step {turn.stepNumber} of {stepCount}
                {turn.mapNumber !== null && turn.action === 'pick' && <> · Map {turn.mapNumber} of {mapCount}</>}
            </p>
            <div className="flex max-w-full items-center gap-3 @xl/arena:gap-5">
                <Chevrons pointing="left" hue={hue} shown={towardsLeft} className={PAGE_CHEVRONS} iconClassName={PAGE_CHEVRON_ICON} />
                <h2 className={cn(TITLE, 'min-w-0 break-words')}>
                    {turn.action === 'decider' ? (
                        <span className={tone.text}>Decider</span>
                    ) : (
                        <>
                            <span className={tone.text}>{turn.actorLabel}</span>
                            <span className="text-foreground"> to {turn.action}</span>
                        </>
                    )}
                </h2>
                <Chevrons pointing="right" hue={hue} shown={!towardsLeft} className={PAGE_CHEVRONS} iconClassName={PAGE_CHEVRON_ICON} />
            </div>
            <p className={cn(DETAIL, turn.viewerActs && !turn.lockedIn && cn('font-semibold', tone.text))}>{turnDetail(turn, previewCard)}</p>
        </>
    )
}

export function Chevrons({ pointing, hue, shown, className, iconClassName }: {
    pointing: 'left' | 'right'
    hue: string
    shown: boolean
    className: string
    iconClassName: string
}) {
    const Icon = pointing === 'left' ? ChevronLeft : ChevronRight
    const order = pointing === 'left' ? CHEVRONS.slice().reverse() : CHEVRONS

    return (
        <span
            aria-hidden
            className={cn('shrink-0 items-center', className, !shown && 'invisible')}
            style={{ color: hue, filter: `drop-shadow(0 0 8px ${tint(hue, 70)})` }}
        >
            {order.map(index => (
                <motion.span
                    key={index}
                    animate={shown ? { opacity: [0.2, 1, 0.2] } : { opacity: 0 }}
                    transition={shown ? { duration: 1.2, repeat: Infinity, delay: index * 0.2, ease: 'easeInOut' } : { duration: 0 }}
                >
                    <Icon className={iconClassName} strokeWidth={3.5} />
                </motion.span>
            ))}
        </span>
    )
}
