import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { useNavState } from '@/app/components/navigation/useNavState'
import { useNavScrollRestore } from '@/app/components/navigation/useNavScrollRestore'
import { useDocumentTitle } from '@/app/components/navigation/useDocumentMeta'
import { SITE_NAME } from '@/app/components/navigation/titles'
import { Spinner } from '@/app/components/ui/spinner'
import { displayMapName } from '@/app/utils/format'
import type { UserProfile } from '@/app/utils/api'
import { useComparisons } from './loading/comparisons'
import { useReplayVideos } from './loading/replayVideos'
import { useSoloRuns } from './loading/soloRuns'
import { composeCompareModel } from './model/compareModel'
import { videoReadOrder } from './model/raceModel'
import { RaceStage } from './stage/RaceStage'
import { useRacePlayback } from './stage/useRacePlayback'
import { useStageBox, useTheaterHeight } from './stage/useStageMeasure'
import { TransportBar } from './transport/TransportBar'
import { parseCompareQuery } from './url/compareUrl'
import './runCompare.css'

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
    const comparisons = useComparisons(useMemo(() => composeCompareModel({ query: compare, runs: loaded }).lanes.requests, [compare, loaded]))
    const model = useMemo(
        () => composeCompareModel({ query: compare, runs: loaded, videos, failedVideos, stageBox, comparisons }),
        [compare, loaded, videos, failedVideos, stageBox, comparisons],
    )
    const { controller, attachMedia } = useRacePlayback(model.race.runs, model.seekSeconds ?? storedSeekSeconds)
    const onVideoFailed = useCallback((capId: string) => {
        setFailedVideos(previous => (previous.has(capId) ? previous : new Set(previous).add(capId)))
    }, [])

    useEffect(() => {
        if (model.loading || model.query === compare) return
        if (model.seekSeconds !== null) setSeekSeconds(model.seekSeconds)
        if (model.noticeLine) setStoredNotice(model.noticeLine)
        replaceParams(model.query ? { compare: model.query } : {})
    }, [model, compare, replaceParams, setSeekSeconds, setStoredNotice])

    useDocumentTitle(model.title, SITE_NAME)
    useNavScrollRestore(!model.loading)

    const notice = model.noticeLine ?? storedNotice
    const hasTiles = model.race.tiles.length > 0

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
                <div ref={setTheater} className="run-compare-theater" style={hasTiles && theaterHeight !== null ? { height: theaterHeight } : undefined}>
                    {hasTiles && (
                        <RaceStage
                            layout={model.race.layout}
                            controller={controller}
                            stageRef={setStage}
                            attachMedia={attachMedia}
                            onVideoFailed={onVideoFailed}
                        />
                    )}
                    <TransportBar controller={controller} race={model.race} lanes={model.lanes} />
                </div>
            )}
        </div>
    )
}
