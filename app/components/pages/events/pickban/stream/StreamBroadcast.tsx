import { useEffect, useMemo, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { playsEntrance, type PickBanView } from '../pickBanView'
import { DISCARDED, endReasonOf, useSceneDirection } from '../components/StageScenes'
import { PICK_BAN_HUES, teamTone, tint } from '../components/pickBanTone'
import { SCENE_VARIANTS } from '../components/stageMotion'
import { StepTrack } from '../components/StepTrack'
import { actorLabelsOf } from '../components/MapTile'
import { BroadcastBoard } from './BroadcastBoard'
import { BroadcastCaption } from './BroadcastCaption'
import { BroadcastLineup, BroadcastNotice, BroadcastPaused } from './BroadcastEndings'
import { BroadcastHeader } from './BroadcastHeader'
import { BroadcastIntro, BroadcastReveal } from './BroadcastMoments'
import '../components/pickBanFonts.css'

const BROADCAST_FONTS = ['600 1em "Barlow Condensed"', '700 1em "Barlow Condensed"', 'italic 800 1em "Barlow Condensed"', 'italic 900 1em "Barlow Condensed"']

function useBroadcastFonts(): void {
    useEffect(() => {
        const fonts = document.fonts
        if (!fonts) return
        for (const font of BROADCAST_FONTS) void fonts.load(font).catch(() => [])
    }, [])
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
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#05070c] font-pickban text-white">
            <BroadcastBackdrop view={view} />
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

function BroadcastBackdrop({ view }: { view: PickBanView }) {
    const left = PICK_BAN_HUES[teamTone(view.teams.left?.ab ?? null)]
    const right = PICK_BAN_HUES[teamTone(view.teams.right?.ab ?? null)]
    const acting = view.stagePhase === 'awaiting' ? view.turn?.ab ?? null : view.stagePhase === 'spotlight' ? view.spotlight?.actor ?? null : null

    return (
        <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
                className="absolute inset-0"
                style={{
                    background: [
                        `radial-gradient(ellipse 55% 70% at 0% 0%, ${tint(left, 20)}, transparent 70%)`,
                        `radial-gradient(ellipse 55% 70% at 100% 0%, ${tint(right, 20)}, transparent 70%)`,
                        'radial-gradient(ellipse 80% 60% at 50% 110%, rgba(255,255,255,0.06), transparent 70%)',
                    ].join(', '),
                }}
            />
            <div
                className="absolute inset-0 opacity-60"
                style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
                    backgroundSize: '64px 64px',
                    maskImage: 'radial-gradient(ellipse 75% 70% at 50% 45%, black, transparent)',
                }}
            />
            <motion.div
                initial={false}
                animate={{ opacity: acting === 'A' ? 1 : 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-y-0 left-0 w-1/2"
                style={{ background: `radial-gradient(ellipse 70% 60% at 0% 55%, ${tint(left, 22)}, transparent 70%)` }}
            />
            <motion.div
                initial={false}
                animate={{ opacity: acting === 'B' ? 1 : 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-y-0 right-0 w-1/2"
                style={{ background: `radial-gradient(ellipse 70% 60% at 100% 55%, ${tint(right, 22)}, transparent 70%)` }}
            />
            <div className="absolute inset-0 shadow-[inset_0_0_220px_rgba(0,0,0,0.75)]" />
        </div>
    )
}
