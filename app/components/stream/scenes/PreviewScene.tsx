import { useMemo } from 'react'
import type { StreamSceneProps } from '../streamSceneOptions'
import { useSceneMatch, useSceneNow, useSceneRead } from '../data/useStreamData'
import { BlankFrame, IdleFrame } from '../frame/IdleFrame'
import { SceneFrame } from '../frame/SceneFrame'
import { previewReadPath, type StreamPreview } from './preview/previewRead'
import { previewView, type PreviewViewModel } from './preview/previewView'
import { PreviewTeamSection } from './preview/PreviewTeamSection'
import { PreviewStagePanel } from './preview/PreviewStagePanel'
import { HeadToHeadPanel, OddsPanel } from './preview/PreviewInsightPanels'

const NOW_STEP_MS = 15_000

function PreviewBody({ matchId, view }: { matchId: string; view: PreviewViewModel }) {
    return (
        <div data-preview-match={matchId} className="grid h-full grid-cols-[1160px_minmax(0,1fr)] gap-x-10">
            <div className="flex min-w-0 flex-col gap-6">
                <PreviewTeamSection side="a" team={view.teams.a} order={0} />
                <PreviewTeamSection side="b" team={view.teams.b} order={3} />
            </div>
            <div className="flex min-h-0 min-w-0 flex-col gap-6">
                <PreviewStagePanel stage={view.stageView} order={1} grow={view.odds === null} />
                {view.headToHead && <HeadToHeadPanel headToHead={view.headToHead} order={2} />}
                {view.odds && <OddsPanel odds={view.odds} order={3} />}
            </div>
        </div>
    )
}

export default function PreviewScene({ eventSlug }: StreamSceneProps) {
    const { phase, match } = useSceneMatch()
    const read = useSceneRead<StreamPreview>(match ? previewReadPath(eventSlug, match.id) : null)
    const now = useSceneNow(NOW_STEP_MS)
    const startsAt = match ? match.countdown_at ?? match.scheduled_at : null
    const view = useMemo(() => (read.data ? previewView({ preview: read.data, startsAt, now }) : null), [read.data, startsAt, now])

    if (phase === 'loading') return <BlankFrame scene="preview" />
    if (phase === 'idle') return <IdleFrame scene="preview" />
    return (
        <SceneFrame scene="preview" title="Match preview" kicker={view?.kicker ?? null}>
            {view && <PreviewBody key={match.id} matchId={match.id} view={view} />}
        </SceneFrame>
    )
}
