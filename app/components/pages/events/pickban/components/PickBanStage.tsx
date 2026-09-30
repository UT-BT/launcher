import { useMemo, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Ban, CircleSlash, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { playsEntrance, type PickBanView } from '../pickBanView'
import { FinalSummary } from './FinalSummary'
import { eligibleCardsOf } from './ExcludedMaps'
import { MapBoard } from './MapBoard'
import { actorLabelsOf } from './MapTile'
import { StageCaption } from './StageCaption'
import { DISCARDED, IntroCard, PausedOverlay, RevealCard, StageNotice, endReasonOf, stageAnnouncement, useSceneDirection } from './StageScenes'
import { PICK_BAN_HUES, teamTone, tint } from './pickBanTone'
import { SCENE_VARIANTS } from './stageMotion'
import './pickBanFonts.css'

interface PickBanStageProps {
    view: PickBanView
    summaryAction?: ReactNode
    onSelect?: (map: string) => void
    className?: string
}

function sceneOverlay(view: PickBanView, summaryAction: ReactNode): ReactNode {
    switch (view.stagePhase) {
        case 'intro':
            return <IntroCard left={view.teams.left} right={view.teams.right} countdown={view.countdown} entranceMs={view.scene.entranceMs} />
        case 'spotlight':
            return view.spotlight
                ? <RevealCard entry={view.spotlight} countdown={view.countdown} upNext={view.turn} entranceMs={view.scene.entranceMs} />
                : null
        case 'complete':
            return <Lineup view={view} summaryAction={summaryAction} />
        case 'cancelled':
            return <StageNotice icon={Ban} title="Picks & Bans have been cancelled" reason={endReasonOf(view.banners)} detail={DISCARDED} />
        case 'voided':
            return (
                <StageNotice
                    icon={CircleSlash}
                    title="Picks & Bans have been voided"
                    reason={endReasonOf(view.banners) ?? 'The match changed after this session opened.'}
                    detail={DISCARDED}
                />
            )
        default:
            return null
    }
}

export function PickBanStage({ view, summaryAction, onSelect, className }: PickBanStageProps) {
    const paused = view.banners.some(banner => banner.kind === 'paused')
    const direction = useSceneDirection(view.scene)
    const actorLabels = useMemo(() => actorLabelsOf(view.teams.left, view.teams.right), [view.teams.left, view.teams.right])
    const overlay = sceneOverlay(view, summaryAction)
    const boardHidden = overlay !== null

    return (
        <section
            aria-label="Picks & Bans Stage"
            className={cn('@container/arena relative isolate min-h-[26rem] overflow-hidden rounded-2xl border border-hairline/10 bg-card/30 px-3 pb-5 sm:px-5', className)}
        >
            <p aria-live="polite" className="sr-only">{paused ? 'Paused.' : stageAnnouncement(view)}</p>
            <StageGlow view={view} />
            <motion.div
                initial={false}
                animate={{ opacity: boardHidden ? 0 : 1 }}
                transition={{ duration: boardHidden ? 0.2 : 0.45 }}
                inert={boardHidden}
                aria-hidden={boardHidden}
                className="relative flex flex-col gap-3"
            >
                <StageCaption view={view} />
                <MapBoard cards={eligibleCardsOf(view.cards)} previewActor={view.turn?.ab ?? null} actorLabels={actorLabels} onSelect={onSelect} />
            </motion.div>
            <AnimatePresence initial={false} custom={direction}>
                {overlay && (
                    <motion.div
                        key={view.scene.key}
                        custom={direction}
                        variants={SCENE_VARIANTS}
                        initial={playsEntrance(view.scene, direction) ? 'hidden' : false}
                        animate="shown"
                        exit="gone"
                        className="@container-size/stage absolute inset-0 flex items-center justify-center p-5"
                    >
                        {overlay}
                    </motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence>{paused && <PausedOverlay key="paused" />}</AnimatePresence>
        </section>
    )
}

function StageGlow({ view }: { view: PickBanView }) {
    const acting = view.stagePhase === 'awaiting' ? view.turn?.ab ?? null : view.stagePhase === 'spotlight' ? view.spotlight?.actor ?? null : null
    const left = PICK_BAN_HUES[teamTone(view.teams.left?.ab ?? null)]
    const right = PICK_BAN_HUES[teamTone(view.teams.right?.ab ?? null)]

    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <motion.div
                initial={false}
                animate={{ opacity: acting === 'A' ? 1 : 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0"
                style={{ background: `radial-gradient(ellipse 60% 70% at 0% 30%, ${tint(left, 16)}, transparent 70%)` }}
            />
            <motion.div
                initial={false}
                animate={{ opacity: acting === 'B' ? 1 : 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0"
                style={{ background: `radial-gradient(ellipse 60% 70% at 100% 30%, ${tint(right, 16)}, transparent 70%)` }}
            />
        </div>
    )
}

function Lineup({ view, summaryAction }: { view: PickBanView; summaryAction: ReactNode }) {
    return (
        <div className="flex w-full flex-col items-center gap-3 @md/stage:gap-5">
            <div className="flex flex-col items-center gap-1 text-center">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-pickban-gold @md/stage:text-xs">
                    <Trophy className="size-3.5" />
                    Picks &amp; Bans complete
                    {view.edited && (
                        <span className="ml-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-px text-[10px] tracking-wider text-amber-300">Edited</span>
                    )}
                </p>
                <h2 className="font-pickban text-2xl font-black italic uppercase leading-none text-foreground @md/stage:text-4xl">Maps in play order</h2>
            </div>
            <FinalSummary entries={view.summary} />
            {summaryAction}
        </div>
    )
}
