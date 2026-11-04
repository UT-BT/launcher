import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { useNavState } from '@/app/components/navigation/useNavState'
import { useNavScrollRestore } from '@/app/components/navigation/useNavScrollRestore'
import { useDocumentTitle } from '@/app/components/navigation/useDocumentMeta'
import { SITE_NAME } from '@/app/components/navigation/titles'
import { LazyModalGate } from '@/app/components/shared/LazyModalGate'
import { Spinner } from '@/app/components/ui/spinner'
import { cn } from '@/lib/utils'
import { displayMapName } from '@/app/utils/format'
import type { UserProfile } from '@/app/utils/api'
import { loadReplayVideoVolume, saveReplayVideoVolume } from '@/app/utils/replayVideoVolume'
import { useAfterPaint } from './analysis/useAfterPaint'
import { AddRuns } from './drawer/AddRuns'
import { RunsDrawer } from './drawer/RunsDrawer'
import { rosterRows, teamRosterGroups } from './drawer/rosterRows'
import { TeamAddRuns } from './drawer/TeamAddRuns'
import type { Shortcut } from './keyboard/shortcuts'
import { useCompareShortcuts } from './keyboard/useCompareShortcuts'
import { useComparisons } from './loading/comparisons'
import { useReplayVideos } from './loading/replayVideos'
import { useSoloRuns } from './loading/soloRuns'
import { useTeamComparisons } from './loading/teamComparisons'
import { useTeamRuns } from './loading/teamRuns'
import { holdWhileAdding, type SetChange } from './model/addRuns'
import { audibleRun, chooseAudio } from './model/audioModel'
import { composeCompareModel, type CompareModel } from './model/compareModel'
import { focusAt, nextAudio, rowAudio, rowFocusAt, toggleFocus } from './model/focusModel'
import { tileOverlays } from './model/overlayModel'
import { isPhone, povForAudio, stageAspect, stageView, stepPov } from './model/phoneStage'
import { editableSet, editSet, type SetEdit } from './model/setEdits'
import { teamVideoOrder } from './model/teamModel'
import { PovSwitcher } from './stage/PovSwitcher'
import { RaceStage, type StageFocus, type StageOverlays } from './stage/RaceStage'
import { useRacePlayback } from './stage/useRacePlayback'
import { useStageFullscreen } from './stage/useStageFullscreen'
import { useStageEnvironment } from './stage/useStageEnvironment'
import { useStageBox, useTheaterHeight } from './stage/useStageMeasure'
import { TransportBar } from './transport/TransportBar'
import { useCueSync } from './transport/useCueSync'
import { parseCompareQuery } from './url/compareUrl'
import './runCompare.css'

const ShortcutSheetModal = lazy(() => import('./keyboard/ShortcutSheetModal').then(m => ({ default: m.ShortcutSheetModal })))
const RunAnalysis = lazy(() => import('./analysis/RunAnalysis'))
const TeamAnalysis = lazy(() => import('./analysis/TeamAnalysis'))

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
    const notCaps = useMemo(() => requested.runs.filter(capId => loaded.get(capId) === null), [requested, loaded])
    const loadedTeams = useTeamRuns(notCaps, userProfile?.accessToken ?? '')
    const videos = useReplayVideos(useMemo(() => teamVideoOrder(compare, loaded, loadedTeams), [compare, loaded, loadedTeams]))
    const [failedVideos, setFailedVideos] = useState<ReadonlySet<string>>(() => new Set())
    const [theater, setTheater] = useState<HTMLElement | null>(null)
    const [stage, setStage] = useState<HTMLElement | null>(null)
    const theaterHeight = useTheaterHeight(theater)
    const stageBox = useStageBox(stage)
    const [speedRun, setSpeedRun] = useNavState<string | null>('compare.speedRun', null)
    const teamComparisons = useTeamComparisons(useMemo(() => composeCompareModel({ query: compare, runs: loaded, teams: loadedTeams }).teams.requests, [compare, loaded, loadedTeams]))
    const comparisons = useComparisons(useMemo(() => composeCompareModel({ query: compare, runs: loaded, teams: loadedTeams, teamComparisons }).lanes.requests, [compare, loaded, loadedTeams, teamComparisons]))
    const [storedFocus, setFocus] = useNavState<string | null>('compare.focus', null)
    const stageEnvironment = useStageEnvironment()
    const [storedPov, setPov] = useNavState<string | null>('compare.pov', null)
    const composed = useMemo(
        () => composeCompareModel({ query: compare, runs: loaded, teams: loadedTeams, teamComparisons, videos, failedVideos, stageBox, comparisons, focus: storedFocus, speedRun, environment: stageEnvironment, pov: storedPov }),
        [compare, loaded, loadedTeams, teamComparisons, videos, failedVideos, stageBox, comparisons, storedFocus, speedRun, stageEnvironment, storedPov],
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
    const teamRoster = useMemo(() => teamRosterGroups(model, roster), [model, roster])
    const teamSet = model.teams.rows.length > 0
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
    const focusTile = useCallback((capId: string | null) => {
        setFocus(capId)
        if (capId !== null && capId !== model.race.focused) setAudioFrom(capId)
    }, [model.race.focused, setFocus, setAudioFrom])
    const focusRow = useCallback((teamCapId: string) => {
        setFocus(teamCapId)
        setAudioFrom(rowAudio(model.race, model.teams, teamCapId, audible))
    }, [model.race, model.teams, audible, setFocus, setAudioFrom])
    const stageFocus = useMemo<StageFocus>(
        () => ({ focused: model.race.focused, onFocus: capId => focusTile(toggleFocus(model.race, model.race.focused, capId)), onFocusRow: focusRow }),
        [model.race, focusTile, focusRow],
    )
    const view = model.race.view
    const phone = isPhone(view.form)
    const choosePov = useCallback((capId: string) => {
        setPov(capId)
        if (audible !== null && !stageView(model.race.tiles, stageEnvironment, capId).visible.includes(audible)) setAudioFrom(capId)
    }, [model.race.tiles, stageEnvironment, audible, setPov, setAudioFrom])
    const swipePov = useCallback((step: 1 | -1) => {
        const next = stepPov(model.race.tiles, view, step)
        if (next !== null && next !== view.pov) choosePov(next)
    }, [model.race.tiles, view, choosePov])
    const audioPov = povForAudio(view, audible)
    useEffect(() => {
        if (audioPov !== null) setPov(audioPov)
    }, [audioPov, setPov])
    const fullscreen = useStageFullscreen(theater)
    const canFullscreen = fullscreen.supported && (model.race.tiles.length > 0 || fullscreen.active)
    const [sheetOpen, setSheetOpen] = useState(false)
    const closeSheet = useCallback(() => setSheetOpen(false), [])
    useCompareShortcuts((shortcut: Shortcut) => {
        switch (shortcut.kind) {
            case 'play-pause':
                if (!controller) return false
                if (controller.getState().playing) controller.pause()
                else controller.play()
                return true
            case 'frame':
                controller?.stepFrame(shortcut.direction)
                return controller !== null
            case 'skip':
                controller?.skip(shortcut.direction)
                return controller !== null
            case 'focus': {
                const capId = focusAt(model.race, shortcut.tile)
                if (capId !== null) focusTile(capId)
                return capId !== null
            }
            case 'focus-row': {
                const teamCapId = rowFocusAt(model.race, model.teams, shortcut.row)
                if (teamCapId !== null) focusRow(teamCapId)
                return teamCapId !== null
            }
            case 'grid':
                focusTile(null)
                return true
            case 'cue':
                if (!controller || model.cues.points.length === 0) return false
                if (shortcut.direction < 0) cueSync.previousCue()
                else cueSync.nextCue()
                return true
            case 'fullscreen':
                if (canFullscreen) fullscreen.toggle()
                return canFullscreen
            case 'reference':
                if (model.race.focused !== null) edit({ kind: 'pin', capId: model.race.focused })
                return model.race.focused !== null
            case 'audio':
                setAudioFrom(nextAudio(model.race, audible))
                return true
            case 'sheet':
                setSheetOpen(true)
                return true
        }
    })
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
        setDrawerOpen(!teamSet && model.runs.length === 1)
    }, [model.loading, model.runs.length, teamSet, storedDrawerOpen, setDrawerOpen])

    useDocumentTitle(model.title, SITE_NAME)
    const analysisReady = useAfterPaint(!model.loading && model.runs.length > 0)
    const hasAnalysis = model.analysis.runs.length > 0 || model.teamAnalysis.teams.length > 0
    useNavScrollRestore(!model.loading && (analysisReady || !hasAnalysis))

    const notice = model.noticeLine ?? storedNotice
    const hasTiles = model.race.tiles.length > 0
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
                <div ref={setTheater} className="run-compare-theater" style={fillsViewport && theaterHeight !== null && !fullscreen.active && !phone ? { height: theaterHeight } : undefined}>
                    {fillsViewport && (
                        <div
                            className={cn('run-compare-stage-area', phone && hasTiles && 'is-phone')}
                            style={phone && hasTiles ? { aspectRatio: stageAspect(view) } : undefined}
                        >
                            {hasTiles && (
                                <RaceStage
                                    layout={model.race.layout}
                                    tiles={model.race.tiles}
                                    view={view}
                                    onSwipe={swipePov}
                                    controller={controller}
                                    stageRef={setStage}
                                    attachMedia={attachMedia}
                                    onVideoFailed={onVideoFailed}
                                    tileOverlays={stageOverlays}
                                    focus={stageFocus}
                                    teamRows={model.teams.rows}
                                />
                            )}
                            <RunsDrawer open={drawerOpen} onClose={closeDrawer} rows={roster} teams={teamRoster} note={editNote} onEdit={edit} audible={audible} onAudio={onAudio} sheet={view.form === 'phone-portrait'}>
                                {teamSet
                                    ? <TeamAddRuns model={model} accessToken={userProfile?.accessToken ?? ''} userId={userProfile?.id ?? null} onChange={applySetChange} />
                                    : <AddRuns model={model} accessToken={userProfile?.accessToken ?? ''} userId={userProfile?.id ?? null} onChange={applySetChange} />}
                            </RunsDrawer>
                        </div>
                    )}
                    {hasTiles && view.switcher && <PovSwitcher tiles={model.race.tiles} view={view} onPov={choosePov} teams={model.teams} />}
                    <TransportBar
                        controller={controller}
                        compact={phone}
                        race={model.race}
                        lanes={model.lanes}
                        runsOpen={drawerOpen}
                        onToggleRuns={() => setDrawerOpen(!drawerOpen)}
                        cues={model.cues}
                        cueSync={cueSync}
                        syncMode={model.sync.mode}
                        onToggleSync={() => edit({ kind: 'sync', mode: model.sync.mode === 'position' ? 'race' : 'position' })}
                        fullscreen={canFullscreen ? { active: fullscreen.active, toggle: fullscreen.toggle } : null}
                        onShortcuts={() => setSheetOpen(true)}
                        teams={model.teams.rows}
                    />
                    <LazyModalGate open={sheetOpen}>
                        <ShortcutSheetModal isOpen={sheetOpen} onClose={closeSheet} portal={!fullscreen.active} />
                    </LazyModalGate>
                </div>
            )}

            {analysisReady && !model.loading && model.analysis.runs.length > 0 && (
                <Suspense fallback={null}>
                    <RunAnalysis analysis={model.analysis} controller={controller} cueSync={cueSync} onSpeedRun={setSpeedRun} />
                </Suspense>
            )}

            {analysisReady && !model.loading && model.teamAnalysis.teams.length > 0 && (
                <Suspense fallback={null}>
                    <TeamAnalysis analysis={model.teamAnalysis} controller={controller} cueSync={cueSync} onSpeedRun={setSpeedRun} />
                </Suspense>
            )}
        </div>
    )
}
