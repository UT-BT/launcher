import { cn } from '@/lib/utils'
import { PICK_BAN_HUES, tint } from '@/app/components/broadcast/broadcastTone'
import type { StreamMatch } from '../../data/streamHotState'
import { sideToneClasses } from '../../sceneHelpers'
import { teamLabel, type SeriesFinalView } from './intermissionView'

const CHIP = 'rounded-md px-3.5 py-1 text-[26px] font-black italic uppercase leading-tight'

export function SeriesFinalCard({ match, final }: { match: StreamMatch; final: SeriesFinalView }) {
    const winner = final.winner
    const team = winner ? teamLabel(match, winner) : null
    const hue = PICK_BAN_HUES[winner ?? 'gold']

    return (
        <section
            data-series-final={winner ?? 'draw'}
            className="flex min-w-0 flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04] px-[30px] py-[26px] text-center shadow-2xl"
        >
            <div className="flex flex-wrap items-center justify-center gap-4">
                {final.official ? (
                    <span className={cn(CHIP, 'bg-emerald-500 text-neutral-950')}>Official result</span>
                ) : (
                    <>
                        <span className={cn(CHIP, 'border-2 border-amber-400 text-amber-400')}>Unofficial</span>
                        <span className="text-xl font-bold uppercase tracking-[0.12em] text-white/60">Live score · awaiting the admin result</span>
                    </>
                )}
            </div>
            <p className="mt-10 text-lg font-bold uppercase tracking-[0.3em] text-white/55">{winner ? 'Series winner' : 'Series drawn'}</p>
            <p
                className={cn('mt-3 break-words text-[88px] font-black italic uppercase leading-[0.9]', winner ? sideToneClasses(winner).text : 'text-white')}
                style={{ textShadow: `0 0 60px ${tint(hue, 50)}, 0 8px 30px rgba(0,0,0,0.6)` }}
            >
                {team ?? 'All square'}
            </p>
            <p className="mt-6 text-[40px] font-black italic uppercase leading-none">
                {winner ? 'Win the series ' : 'Series ends '}
                <span className={sideToneClasses('a').text}>{final.series.a}</span>
                {' – '}
                <span className={sideToneClasses('b').text}>{final.series.b}</span>
            </p>
        </section>
    )
}
