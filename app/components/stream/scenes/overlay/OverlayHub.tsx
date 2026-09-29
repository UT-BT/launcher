import { cn } from '@/lib/utils'
import { PICK_BAN_HUES, tint } from '@/app/components/broadcast/broadcastTone'
import { SceneLogo } from '../../frame/SceneBranding'
import { sideTone, sideToneClasses, type SeriesFlag } from '../../sceneHelpers'
import type { OverlayTeamRow, OverlayView } from './overlayView'
import { SideChip } from './SideChip'

const OPEN_STROKE = 'rgba(255, 255, 255, 0.35)'

function SeriesFlagIcon({ flag, hue }: { flag: SeriesFlag; hue: string }) {
    const won = flag === 'won'
    return (
        <svg viewBox="0 0 22 26" aria-hidden className="h-[26px] w-[22px] shrink-0">
            <path d="M3 2v23" stroke={won ? '#fff' : OPEN_STROKE} strokeWidth={2.5} strokeLinecap="round" />
            <path d="M4.5 3h14l-3.5 5 3.5 5h-14z" fill={won ? hue : 'transparent'} stroke={won ? hue : OPEN_STROKE} strokeWidth={2} strokeLinejoin="round" />
        </svg>
    )
}

function HubRow({ team }: { team: OverlayTeamRow }) {
    const hue = PICK_BAN_HUES[sideTone(team.side)]
    const tone = sideToneClasses(team.side)
    const wins = team.flags.filter(flag => flag === 'won').length

    return (
        <div
            data-overlay-team={team.side}
            className="flex h-[74px] items-center gap-3.5 pr-3"
            style={{ background: `linear-gradient(to right, ${tint(hue, 30)}, ${tint(hue, 8)})` }}
        >
            <span aria-hidden className={cn('w-2 self-stretch', tone.solid)} />
            <SideChip side={team.side} label={team.side.toUpperCase()} />
            <span className="min-w-0 flex-1 truncate font-black italic uppercase" style={{ fontSize: team.name.length > 15 ? 29 : 34 }}>
                {team.name}
            </span>
            <span role="img" aria-label={`${wins} of ${team.flags.length} map wins`} className="flex items-center gap-[3px]">
                {team.flags.map((flag, index) => (
                    <SeriesFlagIcon key={index} flag={flag} hue={hue} />
                ))}
            </span>
            <span
                data-overlay-caps={team.side}
                className={cn(
                    'inline-flex h-[58px] w-[62px] shrink-0 items-center justify-center rounded-[10px] text-[52px] font-black italic leading-[0.9] tabular-nums',
                    tone.solid,
                    tone.onSolid,
                )}
            >
                {team.caps ?? '–'}
            </span>
        </div>
    )
}

export function OverlayHub({ view }: { view: OverlayView }) {
    return (
        <div
            data-overlay-part="hub"
            data-caps-source={view.capsSource ?? undefined}
            className="absolute left-1/2 top-1/2 w-[560px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[14px] bg-[#05070c]/86 shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_16px_20px_-12px_rgba(0,0,0,0.55)]"
        >
            <HubRow team={view.teams[0]} />
            <div className="flex h-[34px] items-center justify-center gap-3 bg-[#05070c]/95 text-[17px] font-bold uppercase tracking-[0.22em] text-white/70">
                <SceneLogo className="size-[26px] object-contain" />
                {view.mapLine}
            </div>
            <HubRow team={view.teams[1]} />
        </div>
    )
}
