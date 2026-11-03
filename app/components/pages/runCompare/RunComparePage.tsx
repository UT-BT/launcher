import { useEffect, useMemo } from 'react'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { useNavState } from '@/app/components/navigation/useNavState'
import { useNavScrollRestore } from '@/app/components/navigation/useNavScrollRestore'
import { useDocumentTitle } from '@/app/components/navigation/useDocumentMeta'
import { SITE_NAME } from '@/app/components/navigation/titles'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { Spinner } from '@/app/components/ui/spinner'
import { displayMapName, formatCapTime } from '@/app/utils/format'
import type { UserProfile } from '@/app/utils/api'
import { useSoloRuns, type SoloRun } from './loading/soloRuns'
import { composeCompareModel } from './model/compareModel'
import { parseCompareQuery } from './url/compareUrl'
import './runCompare.css'

interface RunComparePageProps {
    compare: string
    userProfile?: UserProfile
}

function sideName(side: number | null): string | null {
    if (side === 0) return 'Red'
    if (side === 1) return 'Blue'
    return null
}

function RunRow({ run }: { run: SoloRun }) {
    const side = sideName(run.side)
    return (
        <li className="run-compare-row flex items-center gap-3 px-3 py-1.5">
            <PlayerInfo userId={run.user} alias={run.alias} title={run.title} className="min-h-11 min-w-0 flex-1" />
            {side && <span className="text-xs text-muted-foreground">{side}</span>}
            <span className="font-mono text-sm tabular-nums text-foreground">{formatCapTime(run.timeSeconds)}</span>
        </li>
    )
}

export function RunComparePage({ compare, userProfile }: RunComparePageProps) {
    const { replaceParams } = useNavigation()
    const [storedNotice, setStoredNotice] = useNavState<string | null>('compare.notice', null)
    const [, setSeekSeconds] = useNavState<number | null>('compare.seekSeconds', null)

    const requested = useMemo(() => parseCompareQuery(compare).state.runs, [compare])
    const loaded = useSoloRuns(requested, userProfile?.accessToken ?? '')
    const model = useMemo(() => composeCompareModel({ query: compare, runs: loaded }), [compare, loaded])

    useEffect(() => {
        if (model.loading || model.query === compare) return
        if (model.seekSeconds !== null) setSeekSeconds(model.seekSeconds)
        if (model.noticeLine) setStoredNotice(model.noticeLine)
        replaceParams(model.query ? { compare: model.query } : {})
    }, [model, compare, replaceParams, setSeekSeconds, setStoredNotice])

    useDocumentTitle(model.title, SITE_NAME)
    useNavScrollRestore(!model.loading)

    const notice = model.noticeLine ?? storedNotice

    return (
        <div className="overflow-hidden">
            <div className="space-y-4 p-4 sm:p-6">
                <header className="space-y-1">
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
                    <ol aria-label="Runs" className="divide-y divide-hairline/5 rounded-lg border border-hairline/10 bg-card/40">
                        {model.runs.map(run => <RunRow key={run.capId} run={run} />)}
                    </ol>
                )}
            </div>
        </div>
    )
}
