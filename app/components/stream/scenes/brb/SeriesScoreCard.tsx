import { cn } from '@/lib/utils'
import { PICK_BAN_HUES, tint } from '@/app/components/broadcast/broadcastTone'
import type { StreamSide } from '../../data/streamHotState'
import { sideTone } from '../../sceneHelpers'
import type { SeriesScoreTeam, SeriesScoreView } from './brbView'

function ScoreRow({ side, team, large }: { side: StreamSide; team: SeriesScoreTeam; large: boolean }) {
    const hue = PICK_BAN_HUES[sideTone(side)]
    return (
        <div
            className={cn('flex items-center gap-4 pr-6', large ? 'h-[76px]' : 'h-[62px]')}
            style={{ background: `linear-gradient(to right, ${tint(hue, 28)}, ${tint(hue, 5)})` }}
        >
            <span className="w-2 self-stretch" style={{ background: hue }} />
            <span className={cn('min-w-0 flex-1 truncate font-black italic uppercase', large ? 'text-[40px]' : 'text-[32px]')}>{team.name}</span>
            <span className="flex gap-1">
                {team.flags.map((flag, index) => (
                    <span
                        key={index}
                        className={cn('h-5 w-5 rounded-sm', flag === 'open' && 'bg-white/15')}
                        style={flag === 'won' ? { background: hue } : undefined}
                    />
                ))}
            </span>
            <span className={cn('text-center font-black italic tabular-nums', large ? 'w-[60px] text-[60px]' : 'w-12 text-5xl')}>{team.wins}</span>
        </div>
    )
}

export function SeriesScoreCard({ score, large = false, className }: { score: SeriesScoreView; large?: boolean; className?: string }) {
    return (
        <div data-series-score className={cn('overflow-hidden rounded-[14px] bg-[#05070c]/60 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]', className)}>
            <ScoreRow side="a" team={score.a} large={large} />
            <div
                className={cn(
                    'flex items-center justify-center bg-[#05070c]/90 font-bold uppercase tracking-[0.2em] text-white/65',
                    large ? 'h-9 text-[17px]' : 'h-[34px] text-base'
                )}
            >
                {score.caption}
            </div>
            <ScoreRow side="b" team={score.b} large={large} />
        </div>
    )
}
