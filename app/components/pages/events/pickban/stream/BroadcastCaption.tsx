import type { ReactNode } from 'react'
import { CalendarClock } from 'lucide-react'
import type { PickBanTurn, PickBanView } from '../pickBanView'
import { PICK_BAN_HUES, PICK_BAN_TONES, stepTone } from '../components/pickBanTone'
import { Chevrons } from '../components/StageCaption'

const BROADCAST_CHEVRONS = 'flex -space-x-5'

export function BroadcastCaption({ view }: { view: PickBanView }) {
    return (
        <div className="relative flex h-[104px] shrink-0 items-center justify-center">
            <CaptionContent view={view} />
        </div>
    )
}

function CaptionContent({ view }: { view: PickBanView }) {
    switch (view.stagePhase) {
        case 'none':
            return (
                <CaptionNotice
                    kicker={<><CalendarClock className="size-5" /> Not open yet</>}
                    title="The lobby opens on match day"
                />
            )
        case 'lobby':
            return <CaptionNotice kicker="Lobby open" title="Picks & Bans start soon" />
        case 'awaiting':
        case 'spotlight':
        case 'intro':
            return view.turn ? <TurnCaption turn={view.turn} stepCount={view.timeline.length} mapCount={view.summary.length} /> : null
        default:
            return null
    }
}

function CaptionNotice({ kicker, title }: { kicker: ReactNode; title: string }) {
    return (
        <div className="flex flex-col items-center gap-1 text-center">
            <p className="flex items-center gap-2 text-lg font-bold uppercase tracking-[0.3em] text-white/55">{kicker}</p>
            <p className="text-[52px] font-black italic uppercase leading-none text-white">{title}</p>
        </div>
    )
}

function TurnCaption({ turn, stepCount, mapCount }: { turn: PickBanTurn; stepCount: number; mapCount: number }) {
    const toneKey = stepTone(turn.ab)
    const tone = PICK_BAN_TONES[toneKey]
    const hue = PICK_BAN_HUES[toneKey]
    const towardsLeft = turn.ab === 'A'
    const verb = turn.action === 'decider' ? 'Decider' : `to ${turn.action}`

    return (
        <div className="flex items-center gap-7">
            <Chevrons pointing="left" hue={hue} shown={towardsLeft} className={BROADCAST_CHEVRONS} iconClassName="size-14" />
            <div className="flex min-w-0 flex-col items-center gap-1 text-center">
                <p className="text-lg font-bold uppercase tracking-[0.3em] text-white/55">
                    Step {turn.stepNumber} of {stepCount}
                    {turn.mapNumber !== null && turn.action === 'pick' && `  ·  Map ${turn.mapNumber} of ${mapCount}`}
                </p>
                <p className="max-w-[1300px] truncate text-[56px] font-black italic uppercase leading-none tracking-tight">
                    {turn.action !== 'decider' && <span className={tone.text}>{turn.actorLabel} </span>}
                    <span className="text-white">{verb}</span>
                </p>
            </div>
            <Chevrons pointing="right" hue={hue} shown={!towardsLeft} className={BROADCAST_CHEVRONS} iconClassName="size-14" />
        </div>
    )
}
