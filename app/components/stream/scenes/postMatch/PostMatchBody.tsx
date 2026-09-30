import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { EASE_OUT, FADE_MOTION, SLAM } from '@/app/components/broadcast/broadcastMotion'
import { PICK_BAN_HUES, tint } from '@/app/components/broadcast/broadcastTone'
import type { StreamSceneOptions } from '../../streamSceneOptions'
import type { StreamMatch, StreamSide } from '../../data/streamHotState'
import { useSceneCadence, useSceneRead } from '../../data/useStreamData'
import { sideToneClasses } from '../../sceneHelpers'
import { SceneFrame } from '../../frame/SceneFrame'
import { ConsequencePanel } from './ConsequencePanel'
import { SeriesTable } from './SeriesTable'
import { postMatchReadPath, type PostMatchRead } from './postMatchRead'
import { isMatchFinished, isPostMatchDecided, postMatchView, type PostMatchView } from './postMatchView'
import { useWinnerCue } from './useWinnerCue'

type ResultView = Extract<PostMatchView, { phase: 'result' }>

const WINNER_STAMP_DELAY_S = 0.3
const WINNER_STAMP_S = 0.25
const WINNER_HIT_MS = (WINNER_STAMP_DELAY_S + WINNER_STAMP_S) * 1000

const OTHER_SIDE: Record<StreamSide, StreamSide> = { a: 'b', b: 'a' }

function winnerNameSize(name: string): number {
    if (name.length > 24) return 96
    if (name.length > 18) return 120
    return 150
}

type PostMatchState = 'in-progress' | 'official' | 'unofficial'

const KICKERS: Record<PostMatchState, string> = { 'in-progress': 'Awaiting result', official: 'Final', unofficial: 'Unofficial' }

function stateOf(view: PostMatchView): PostMatchState {
    if (view.phase === 'in-progress') return 'in-progress'
    return view.official ? 'official' : 'unofficial'
}

function Marker({ state }: { state: PostMatchState }) {
    if (state === 'in-progress') {
        return (
            <div className="flex items-center gap-4">
                <span className="rounded-md border-2 border-white/30 bg-white/5 px-3.5 py-1 text-[26px] font-black italic uppercase leading-tight tracking-[0.05em] text-white/70">
                    Match in progress
                </span>
                <span className="text-2xl font-bold uppercase tracking-[0.12em] text-white/60">Live score · no winner yet</span>
            </div>
        )
    }
    if (state === 'official') {
        return (
            <span className="rounded-md bg-emerald-400 px-3.5 py-1 text-[26px] font-black italic uppercase leading-tight tracking-[0.05em] text-neutral-950">
                Official result
            </span>
        )
    }
    return (
        <div className="flex items-center gap-4">
            <span className="rounded-md border-2 border-amber-400 bg-amber-400/15 px-3.5 py-1 text-[26px] font-black italic uppercase leading-tight tracking-[0.05em] text-amber-400">
                Unofficial
            </span>
            <span className="text-2xl font-bold uppercase tracking-[0.12em] text-white/60">Live score · awaiting the admin result</span>
        </div>
    )
}

function SeriesLine({ view }: { view: ResultView }) {
    const first = view.winner ?? 'a'
    const second = OTHER_SIDE[first]
    const score = (
        <>
            <span className={sideToneClasses(first).text}>{view.series[first]}</span> – <span className={sideToneClasses(second).text}>{view.series[second]}</span>
        </>
    )
    return (
        <p className="mt-2.5 max-w-full text-balance text-center text-[40px] font-black italic uppercase leading-tight">
            {view.winner ? <>Win the series {score} </> : <>Series drawn {score} </>}
            <span className="text-white/60">{view.winner ? 'vs' : '·'}</span>{' '}
            {view.winner ? (
                <span className={sideToneClasses(second).text}>{view.teams[second]}</span>
            ) : (
                <>
                    <span className={sideToneClasses('a').text}>{view.teams.a}</span> and <span className={sideToneClasses('b').text}>{view.teams.b}</span>
                </>
            )}
        </p>
    )
}

function WinnerName({ view, reveal }: { view: ResultView; reveal: number }) {
    const name = view.winner ? view.teams[view.winner] : 'Draw'
    const hue = view.winner ? PICK_BAN_HUES[view.winner] : PICK_BAN_HUES.gold
    return (
        <motion.p
            key={reveal}
            initial={{ opacity: 0, scale: 1.25 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: WINNER_STAMP_DELAY_S, duration: WINNER_STAMP_S, ease: SLAM }}
            data-post-match-winner={view.winner ?? 'draw'}
            className="mt-1.5 max-w-full text-balance px-6 text-center font-black italic uppercase leading-[0.9]"
            style={{
                fontSize: winnerNameSize(name),
                color: hue,
                textShadow: `0 0 60px ${tint(hue, 50)}, 0 8px 30px rgba(0,0,0,0.6)`,
            }}
        >
            {name}
        </motion.p>
    )
}

function ResultBody({ view, reveal }: { view: ResultView; reveal: number }) {
    const withConsequence = view.consequence.length > 0
    return (
        <>
            <p className="mt-[22px] text-lg font-bold uppercase tracking-[0.3em] text-white/55">{view.winner ? 'Winner' : 'Result'}</p>
            <WinnerName view={view} reveal={reveal} />
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: WINNER_STAMP_DELAY_S + WINNER_STAMP_S, duration: 0.35, ease: EASE_OUT }} className="flex max-w-full flex-col items-center">
                <SeriesLine view={view} />
                {view.maps.length > 0 && (
                    <div className={cn('rounded-3xl border border-white/10 bg-white/4 px-[18px] py-3 shadow-2xl shadow-black/50', withConsequence ? 'mt-[22px]' : 'mt-9')}>
                        <SeriesTable teams={view.teams} series={view.series} maps={view.maps} tileSize={withConsequence ? 118 : 146} />
                    </div>
                )}
            </motion.div>
            <AnimatePresence>{withConsequence && <ConsequencePanel lines={view.consequence} />}</AnimatePresence>
        </>
    )
}

function InProgressBody({ view }: { view: Extract<PostMatchView, { phase: 'in-progress' }> }) {
    return (
        <motion.div {...FADE_MOTION} className="flex max-w-full flex-col items-center">
            <p className="mt-[22px] text-lg font-bold uppercase tracking-[0.3em] text-white/55">Series so far</p>
            <p className="mt-2.5 max-w-full text-balance text-center text-[64px] font-black italic uppercase leading-none">
                <span className={sideToneClasses('a').text}>{view.teams.a}</span>{' '}
                <span className="tabular-nums">{view.series.a} – {view.series.b}</span>{' '}
                <span className={sideToneClasses('b').text}>{view.teams.b}</span>
            </p>
            {view.maps.length > 0 && (
                <div className="mt-12 rounded-3xl border border-white/10 bg-white/4 px-[18px] py-3 shadow-2xl shadow-black/50">
                    <SeriesTable teams={view.teams} series={view.series} maps={view.maps} tileSize={146} live />
                </div>
            )}
        </motion.div>
    )
}

export function PostMatchBody({ eventSlug, match, options }: { eventSlug: string; match: StreamMatch; options: StreamSceneOptions }) {
    const decided = isPostMatchDecided(match.score)
    const read = useSceneRead<PostMatchRead>(isMatchFinished(match) ? postMatchReadPath(eventSlug, match.id) : null)
    const view = useMemo(() => postMatchView(match, read.data), [match, read.data])
    const { active } = useSceneCadence()
    const reveal = useWinnerCue({ matchId: match.id, decided, active }, options.sound, options.animate ? WINNER_HIT_MS : 0)
    const state = stateOf(view)

    return (
        <SceneFrame scene="post-match" title="Result" kicker={KICKERS[state]}>
            <div data-post-match={state} data-stream-match={match.id} className="flex h-full flex-col items-center">
                <Marker state={state} />
                {view.phase === 'result' ? <ResultBody view={view} reveal={reveal} /> : <InProgressBody view={view} />}
            </div>
        </SceneFrame>
    )
}
