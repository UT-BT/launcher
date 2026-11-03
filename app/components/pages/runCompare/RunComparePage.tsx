import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { useNavState } from '@/app/components/navigation/useNavState'
import { useNavScrollRestore } from '@/app/components/navigation/useNavScrollRestore'
import { useDocumentTitle } from '@/app/components/navigation/useDocumentMeta'
import { SITE_NAME } from '@/app/components/navigation/titles'
import { Spinner } from '@/app/components/ui/spinner'
import { displayMapName } from '@/app/utils/format'
import type { UserProfile } from '@/app/utils/api'
import { loadReplayVideoVolume, saveReplayVideoVolume } from '@/app/utils/replayVideoVolume'
import { useAfterPaint } from './analysis/useAfterPaint'
import { AddRuns } from './drawer/AddRuns'
import { RunsDrawer } from './drawer/RunsDrawer'
import { rosterRows } from './drawer/rosterRows'
import { useComparisons } from './loading/comparisons'
import { useReplayVideos } from './loading/replayVideos'
import { useSoloRuns } from './loading/soloRuns'
import { holdWhileAdding, type SetChange } from './model/addRuns'
import { audibleRun, chooseAudio } from './model/audioModel'
import { composeCompareModel, type CompareModel } from './model/compareModel'
import { tileOverlays } from './model/overlayModel'
import { videoReadOrder } from './model/raceModel'
import { editableSet, editSet, type SetEdit } from './model/setEdits'
import { RaceStage, type StageOverlays } from './stage/RaceStage'
import { useRacePlayback } from './stage/useRacePlayback'
import { useStageBox, useTheaterHeight } from './stage/useStageMeasure'
import { TransportBar } from './transport/TransportBar'
import { useCueSync } from './transport/useCueSync'
import { parseCompareQuery } from './url/compareUrl'
import './runCompare.css'

const RunAnalysis = lazy(() => import('./analysis/RunAnalysis'))

interface RunComparePageProps {
    compare: string
    userProfile?: UserProfile
}

export function RunComparePage({ compare, userProfile }: RunComparePageProps) {
    const { replaceParams } = useNavigation()
    const [storedNotice, setStoredNotice] = useNavState<string | null>('compare.notice', null)
    const [storedSeekSeconds, setSeekSeconds] = useNavState<number | null>('compare.seekSeconds', null)

    const requested = useMemo(() => parseCompareQuery(compare).state, [compare])
    const loaded = useSoloRuns(requested.runs, userProfile?.accessToken ?? '')
    const videos = useReplayVideos(useMemo(() => videoReadOrder(requested), [requested]))
    const [failedVideos, setFailedVideos] = useState<ReadonlySet<string>>(() => new Set())
    const [theater, setTheater] = useState<HTMLElement | null>(null)
    const [stage, setStage] = useState<HTMLElement | null>(null)
    const theaterHeight = useTheaterHeight(theater)
    const stageBox = useStageBox(stage)
    const [speedRun, setSpeedRun] = useNavState<string | null>('compare.speedRun', null)
    const comparisons = useComparisons(useMemo(() => composeCompareModel({ query: compare, runs: loaded }).lanes.requests, [compare, loaded]))
    const composed = useMemo(
        () => composeCompareModel({ query: compare, runs: loaded, videos, failedVideos, stageBox, comparisons, speedRun }),
        [compare, loaded, videos, failedVideos, stageBox, comparisons, speedRun],
    )
    const settled = useRef<CompareModel | null>(null)
    const model = useMemo(() => holdWhileAdding(composed, settled.current), [composed])
    useEffect(() => {
        if (!composed.loading) settled.current = composed
    }, [composed])
    const { controller, attachMedia } = useRacePlayback(model.race.runs, model.seekSeconds ?? storedSeekSeconds)
    const cueSync = useCueSync(controller, model.cues, model.sync)
    const [storedDrawerOpen, setDrawerOpen] = useNavState<boolean | null>('compare.drawerOpen', null)
    const [editNote, setEditNote] = useState<string | null>(null)
    const drawerOpen = storedDrawerOpen === true && !model.loading && model.runs.length > 0
    const closeDrawer = useCallback(() => setDrawerOpen(false), [setDrawerOpen])
    const edit = useCallback((change: SetEdit) => {
        const outcome = editSet(editableSet(model), change)
        setEditNote(outcome.blocked)
        if (outcome.query === null) return
        setStoredNotice(null)
        if (outcome.query !== model.query) replaceParams(outcome.query ? { compare: outcome.query } : {})
    }, [model, replaceParams, setStoredNotice])
    const applySetChange = useCallback(({ outcome, note }: SetChange) => {
        setEditNote(outcome.blocked ?? note)
        if (outcome.query === null) return
        setStoredNotice(null)
        if (outcome.query !== model.query) replaceParams(outcome.query ? { compare: outcome.query } : {})
    }, [model.query, replaceParams, setStoredNotice])
    const roster = useMemo(() => rosterRows({ model, videos, failedVideos }), [model, videos, failedVideos])
    const [audioFrom, setAudioFrom] = useNavState<string | null>('compare.audioFrom', null)
    const [volume, setVolume] = useState(loadReplayVideoVolume)
    const audible = audibleRun(model.race, audioFrom)
    const onAudio = useCallback((capId: string) => setAudioFrom(chooseAudio(model.race, audible, capId)), [model.race, audible, setAudioFrom])
    const onVolume = useCallback((next: number) => {
        setVolume(next)
        saveReplayVideoVolume(next)
    }, [])
    const stageOverlays = useMemo<StageOverlays>(
        () => ({ overlays: tileOverlays(model), audio: { audible, volume, onAudio, onVolume }, onEdit: edit }),
        [model, audible, volume, onAudio, onVolume, edit],
    )
    const onVideoFailed = useCallback((capId: string) => {
        setFailedVideos(previous => (previous.has(capId) ? previous : new Set(previous).add(capId)))
    }, [])

    useEffect(() => {
        if (model.loading || model.query === compare) return
        if (model.seekSeconds !== null) setSeekSeconds(model.seekSeconds)
        if (model.noticeLine) setStoredNotice(model.noticeLine)
        replaceParams(model.query ? { compare: model.query } : {})
    }, [model, compare, replaceParams, setSeekSeconds, setStoredNotice])

    useEffect(() => {
        if (model.loading || storedDrawerOpen !== null) return
        setDrawerOpen(model.runs.length === 1)
    }, [model.loading, model.runs.length, storedDrawerOpen, setDrawerOpen])

    useDocumentTitle(model.title, SITE_NAME)
    useNavScrollRestore(!model.loading)

    const notice = model.noticeLine ?? storedNotice
    const hasTiles = model.race.tiles.length > 0
    const analysisReady = useAfterPaint(!model.loading && model.runs.length > 0)
    const fillsViewport = hasTiles || drawerOpen

    return (
        <div className="run-compare-page">
            <header className="run-compare-header">
                <h1 className="text-xl font-semibold text-foreground">Compare Runs</h1>
                {model.map && <p className="text-sm text-muted-foreground">{displayMapName(model.map)}</p>}
            </header>

            {notice && !model.loading && (
                <p role="status" className="rounded-md border border-hairline/10 bg-card/50 px-3 py-2 text-sm text-muted-foreground">
                    {notice}
                </p>
            )}

            {model.loading && (
                <div className="flex items-center justify-center py-24 text-muted-foreground">
                    <Spinner className="size-6" />
                </div>
            )}

            {!model.loading && model.runs.length === 0 && (
                <p className="py-16 text-center font-medium text-muted-foreground">No runs to compare</p>
            )}

            {!model.loading && model.runs.length > 0 && (
                <div ref={setTheater} className="run-compare-theater" style={fillsViewport && theaterHeight !== null ? { height: theaterHeight } : undefined}>
                    {fillsViewport && (
                        <div className="run-compare-stage-area">
                            {hasTiles && (
                                <RaceStage
                                    layout={model.race.layout}
                                    controller={controller}
                                    stageRef={setStage}
                                    attachMedia={attachMedia}
                                    onVideoFailed={onVideoFailed}
                                    tileOverlays={stageOverlays}
                                />
                            )}
                            <RunsDrawer open={drawerOpen} onClose={closeDrawer} rows={roster} note={editNote} onEdit={edit} audible={audible} onAudio={onAudio}>
                                <AddRuns model={model} accessToken={userProfile?.accessToken ?? ''} userId={userProfile?.id ?? null} onChange={applySetChange} />
                            </RunsDrawer>
                        </div>
                    )}
                    <TransportBar
                        controller={controller}
                        race={model.race}
                        lanes={model.lanes}
                        runsOpen={drawerOpen}
                        onToggleRuns={() => setDrawerOpen(!drawerOpen)}
                        cues={model.cues}
                        cueSync={cueSync}
                        syncMode={model.sync.mode}
                        onToggleSync={() => edit({ kind: 'sync', mode: model.sync.mode === 'position' ? 'race' : 'position' })}
                    />
                </div>
            )}

            {analysisReady && !model.loading && model.runs.length > 0 && (
                <Suspense fallback={null}>
                    <RunAnalysis analysis={model.analysis} controller={controller} cueSync={cueSync} onSpeedRun={setSpeedRun} />
                </Suspense>
            )}
        </div>
    )
}
