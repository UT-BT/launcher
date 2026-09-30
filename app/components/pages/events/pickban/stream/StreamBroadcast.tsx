import { useMemo, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { BroadcastBackdrop } from '@/app/components/broadcast/BroadcastBackdrop'
import { useBroadcastFonts } from '@/app/components/broadcast/broadcastFonts'
import { SCENE_VARIANTS } from '@/app/components/broadcast/broadcastMotion'
import { BROADCAST_SURFACE, teamTone } from '@/app/components/broadcast/broadcastTone'
import { playsEntrance, type PickBanView } from '../pickBanView'
import { DISCARDED, endReasonOf, useSceneDirection } from '../components/StageScenes'
import { StepTrack } from '../components/StepTrack'
import { actorLabelsOf } from '../components/MapTile'
import { BroadcastBoard } from './BroadcastBoard'
import { BroadcastCaption } from './BroadcastCaption'
import { BroadcastLineup, BroadcastNotice, BroadcastPaused } from './BroadcastEndings'
import { BroadcastHeader } from './BroadcastHeader'
import { BroadcastIntro, BroadcastReveal } from './BroadcastMoments'

function backdropLit(view: PickBanView): 'left' | 'right' | null {
    const acting = view.stagePhase === 'awaiting' ? view.turn?.ab ?? null : view.stagePhase === 'spotlight' ? view.spotlight?.actor ?? null : null
    if (acting === 'A') return 'left'
    if (acting === 'B') return 'right'
    return null
}

function sceneOverlay(view: PickBanView): ReactNode {
    switch (view.stagePhase) {
        case 'intro':
            return <BroadcastIntro left={view.teams.left} right={view.teams.right} countdown={view.countdown} entranceMs={view.scene.entranceMs} />
        case 'spotlight':
            return view.spotlight
                ? <BroadcastReveal entry={view.spotlight} countdown={view.countdown} upNext={view.turn} entranceMs={view.scene.entranceMs} />
                : null
        case 'complete':
            return <BroadcastLineup entries={view.summary} edited={view.edited} />
        case 'cancelled':
        case 'voided':
            return (
                <BroadcastNotice
                    kind={view.stagePhase}
                    reason={endReasonOf(view.banners) ?? (view.stagePhase === 'voided' ? 'The match changed after this session opened.' : null)}
                    detail={DISCARDED}
                />
            )
        default:
            return null
    }
}

export function StreamBroadcast({ view, eventName }: { view: PickBanView; eventName: string | null }) {
    useBroadcastFonts()
    const direction = useSceneDirection(view.scene)
    const actorLabels = useMemo(() => actorLabelsOf(view.teams.left, view.teams.right), [view.teams.left, view.teams.right])
    const overlay = sceneOverlay(view)
    const boardHidden = overlay !== null
    const paused = view.banners.some(banner => banner.kind === 'paused')

    return (
        <div className={cn('relative flex h-full w-full flex-col overflow-hidden', BROADCAST_SURFACE)}>
            <BroadcastBackdrop left={teamTone(view.teams.left?.ab ?? null)} right={teamTone(view.teams.right?.ab ?? null)} lit={backdropLit(view)} />
            <BroadcastHeader view={view} eventName={eventName} />
            <main className="relative flex min-h-0 flex-1 flex-col">
                <motion.div initial={false} animate={{ opacity: boardHidden ? 0 : 1 }} transition={{ duration: boardHidden ? 0.2 : 0.45 }} className="flex min-h-0 flex-1 flex-col">
                    <BroadcastCaption view={view} />
                    <BroadcastBoard cards={view.cards} previewActor={view.turn?.ab ?? null} actorLabels={actorLabels} />
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
                            className="absolute inset-0 z-20 flex items-center justify-center"
                        >
                            {overlay}
                        </motion.div>
                    )}
                </AnimatePresence>
                <AnimatePresence>{paused && <BroadcastPaused key="paused" />}</AnimatePresence>
            </main>
            <footer className="relative z-10 shrink-0 px-16 pb-10 pt-4">
                {view.timeline.length > 0 && <StepTrack entries={view.timeline} skippedBans={view.skippedBans} size="broadcast" />}
            </footer>
        </div>
    )
}
