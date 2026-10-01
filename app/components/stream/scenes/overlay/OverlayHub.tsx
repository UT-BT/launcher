import { cn } from '@/lib/utils'
import { PICK_BAN_HUES, tint } from '@/app/components/broadcast/broadcastTone'
import { sideTone, sideToneClasses, type SeriesFlag } from '../../sceneHelpers'
import { BAND, SCORE_ROW } from './overlayLayout'
import { OverlayMapStrip } from './OverlayMapStrip'
import { OverlaySeamRail } from './OverlaySeamRails'
import type { OverlayTeamRow, OverlayView } from './overlayView'

const HUB_SHADOW = 'drop-shadow-[0_10px_12px_rgba(0,0,0,0.4)]'

function Pips({ pips }: { pips: SeriesFlag[] }) {
    const won = pips.filter(pip => pip === 'won').length
    return (
        <span role="img" aria-label={`${won} of ${pips.length} maps won`} className="flex shrink-0 items-center gap-[3px] px-0.5">
            {pips.map((pip, index) => (
                <i
                    key={index}
                    data-pip={pip}
                    className={cn('block h-[18px] w-[7px] -skew-x-14 rounded-[1.5px]', pip === 'won' ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.35)]' : 'bg-white/20')}
                />
            ))}
        </span>
    )
}

function ScoreRow({ team, className }: { team: OverlayTeamRow; className: string }) {
    const hue = PICK_BAN_HUES[sideTone(team.side)]
    const tone = sideToneClasses(team.side)

    return (
        <div
            data-overlay-team={team.side}
            className={cn('overflow-hidden bg-[#05070c]/86 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]', className)}
            style={{ width: SCORE_ROW.width }}
        >
            <div
                className="flex items-center gap-2.5 pr-1.5"
                style={{ height: SCORE_ROW.height, background: `linear-gradient(to right, ${tint(hue, 30)}, ${tint(hue, 8)})` }}
            >
                <span aria-hidden className={cn('w-1.5 self-stretch', tone.solid)} />
                <span
                    className="min-w-0 flex-1 truncate pb-[0.04em] pl-[0.02em] pr-[0.12em] pt-[0.08em] font-black italic uppercase leading-none tracking-[-0.005em] [text-shadow:0_2px_10px_rgba(0,0,0,0.45)]"
                    style={{ fontSize: team.longName ? 25 : 29 }}
                >
                    {team.name}
                </span>
                <Pips pips={team.pips} />
                <span
                    data-overlay-caps={team.side}
                    className={cn(
                        'inline-flex h-[38px] w-[46px] shrink-0 items-center justify-center rounded-[7px] pr-[0.06em] text-[38px] font-black italic leading-[0.9] tabular-nums',
                        tone.solid,
                        tone.onSolid,
                    )}
                >
                    {team.caps ?? '–'}
                </span>
            </div>
        </div>
    )
}

export function OverlayHub({ view }: { view: OverlayView }) {
    return (
        <div
            data-overlay-part="hub"
            data-caps-source={view.capsSource ?? undefined}
            className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
        >
            <ScoreRow team={view.teams[0]} className={cn('rounded-t-[10px]', HUB_SHADOW)} />
            <div data-overlay-seam className="relative flex justify-center" style={{ minWidth: SCORE_ROW.width, height: BAND.height }}>
                <OverlaySeamRail edge="left" />
                <OverlaySeamRail edge="right" />
                <div className={HUB_SHADOW}>
                    <OverlayMapStrip strip={view.strip} />
                </div>
            </div>
            <ScoreRow team={view.teams[1]} className={cn('rounded-b-[10px]', HUB_SHADOW)} />
        </div>
    )
}
