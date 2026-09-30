import { Fragment } from 'react'
import { cn } from '@/lib/utils'
import type { BracketBox, BracketLine, BracketRound, BracketView } from './standingsView'
import { BRACKET_COLUMN_HEIGHT } from './standingsView'
import { LABEL, TEAM_NAME, sideWash } from './StandingsParts'

function Line({ line }: { line: BracketLine }) {
    return (
        <div data-side={line.side ?? undefined} className="flex h-[50px] items-center gap-2.5 px-3.5" style={sideWash(line.side, 20)}>
            <span className={cn(TEAM_NAME, 'min-w-0 flex-1 text-2xl', !line.known ? 'text-white/40' : !line.won && !line.side && 'text-white/60')}>{line.name}</span>
            {line.score !== null && (
                <span className={cn('text-[26px] font-black italic leading-[0.9] tabular-nums', line.won ? 'text-pickban-gold' : 'text-white/50')}>{line.score}</span>
            )}
        </div>
    )
}

function Box({ box }: { box: BracketBox }) {
    return (
        <div
            data-bracket-match={box.id}
            data-highlight={box.highlight || undefined}
            className={cn(
                'w-80 shrink-0 overflow-hidden rounded-xl bg-white/5',
                box.highlight ? 'ring-2 ring-white/55' : 'ring-1 ring-white/10',
                box.current && 'shadow-[0_0_30px_rgba(255,255,255,0.12)]',
            )}
        >
            <p className={cn(
                'flex h-[26px] items-center justify-center text-[15px] font-bold uppercase tracking-[0.2em]',
                box.current ? 'bg-white/[0.14] text-white' : 'bg-white/[0.06] text-white/60',
            )}>
                {box.tag}
            </p>
            <Line line={box.lines[0]} />
            <div className="h-px bg-white/10" />
            <Line line={box.lines[1]} />
        </div>
    )
}

function Arrow() {
    return (
        <svg aria-hidden width="44" height="30" viewBox="0 0 44 30" className="mt-10 shrink-0 self-center">
            <path d="M2 15h36m-10-10 10 10-10 10" stroke="rgba(255,255,255,.3)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function Column({ round, height }: { round: BracketRound; height: number }) {
    return (
        <div className="flex shrink-0 flex-col items-center gap-[18px]">
            <p className={cn(LABEL, 'text-lg')}>{round.label}</p>
            <div className="flex flex-col justify-around gap-[18px]" style={{ height }}>
                {round.boxes.map(box => <Box key={box.id} box={box} />)}
            </div>
        </div>
    )
}

export function StandingsBracket({ view }: { view: BracketView }) {
    const height = BRACKET_COLUMN_HEIGHT / view.scale
    return (
        <div data-standings-kind="bracket" data-bracket-region={view.region || undefined} className="relative h-full">
            <div className="flex justify-center pt-1.5">
                <div className="flex shrink-0 origin-top items-start gap-3.5" style={view.scale < 1 ? { transform: `scale(${view.scale})` } : undefined}>
                    {view.rounds.map((round, index) => (
                        <Fragment key={round.no}>
                            {index > 0 && <Arrow />}
                            <Column round={round} height={height} />
                        </Fragment>
                    ))}
                </div>
            </div>
            <p className="absolute inset-x-0 bottom-0 truncate text-center text-xl font-bold uppercase tracking-[0.14em] text-white/50">{view.footer}</p>
        </div>
    )
}
