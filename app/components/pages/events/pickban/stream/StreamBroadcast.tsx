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
import { BroadcastIntro, BroadcastReveal, BroadcastSideChoice, BroadcastSideReveal, BroadcastVetoReveal } from './BroadcastMoments'
import { broadcastBackdropLit, broadcastMomentOf } from './broadcastMoment'

function sceneOverlay(view: PickBanView): ReactNode {
    const moment = broadcastMomentOf(view)
    switch (moment?.kind) {
        case 'intro':
            return (
                <BroadcastIntro
                    left={view.teams.left}
                    right={view.teams.right}
                    countdown={view.countdown}
                    sidesLine={moment.sidesLine}
                    entranceMs={view.scene.entranceMs}
                />
            )
        case 'veto_reveal':
            return (
                <BroadcastVetoReveal
                    key={moment.reveal.id}
                    tag={moment.tag}
                    reveal={moment.reveal}
                    maps={moment.maps}
                    next={moment.next}
                    countdown={view.countdown}
                    entranceMs={view.scene.entranceMs}
                />
            )
        case 'side_choice':
            return <BroadcastSideChoice chooser={moment.chooser} options={moment.options} reason={moment.reason} entranceMs={view.scene.entranceMs} />
        case 'side_reveal':
            return <BroadcastSideReveal reveal={moment.reveal} countdown={view.countdown} upNext={view.turn} entranceMs={view.scene.entranceMs} />
        case 'reveal':
            return <BroadcastReveal entry={moment.entry} countdown={view.countdown} upNext={view.turn} entranceMs={view.scene.entranceMs} />
        case 'lineup':
            return <BroadcastLineup entries={view.summary} edited={view.edited} />
        case 'notice':
            return (
                <BroadcastNotice
                    kind={moment.notice}
                    reason={endReasonOf(view.banners) ?? (moment.notice === 'voided' ? 'The match changed after this session opened.' : null)}
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
            <BroadcastBackdrop left={teamTone(view.teams.left?.ab ?? null)} right={teamTone(view.teams.right?.ab ?? null)} lit={broadcastBackdropLit(view)} />
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
