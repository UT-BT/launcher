import { cn } from '@/lib/utils'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { PICK_BAN_TONES } from '@/app/components/broadcast/broadcastTone'
import { teamMapView, type MapSideView } from '@/app/components/pages/events/stats/statsView'
import type { EventRun, EventTeamStatsMap } from '@/app/utils/api'
import { ResultBadge, useTeamPage } from './teamShared'
import { RunRow, UnrecordedRow } from './RunRow'

function SideRuns({ label, accent, runs, side, own }: {
    label: string
    accent?: string
    runs: EventRun[]
    side: MapSideView
    own: boolean
}) {
    return (
        <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-[11px] font-semibold text-muted-foreground" style={accent ? { color: accent } : undefined}>
                {label}
            </span>
            {runs.map(run => <RunRow key={run.team_run_id ?? run.members[0]?.cap_id ?? run.completed_at} run={run} own={own} />)}
            {side.placeholders.map((text, index) => <UnrecordedRow key={index} text={text} />)}
            {side.noCapsText && <span className="py-1 text-xs italic text-muted-foreground">{side.noCapsText}</span>}
        </div>
    )
}

export function MapRow({ map, teamId, teamName, opponentName }: {
    map: EventTeamStatsMap
    teamId: string
    teamName: string
    opponentName: string
}) {
    const { names, accentOf } = useTeamPage()
    const view = teamMapView(map, names)

    const head = (
        <div className="flex min-w-0 items-center gap-2.5">
            <MapThumbnail mapName={view.map} alt="" className="size-10 shrink-0 rounded-md" />
            <div className="min-w-0">
                <div className="truncate text-sm font-bold text-foreground">{view.displayName}</div>
                {view.pickLabel && (
                    <div className="truncate text-xs text-muted-foreground">
                        {view.pickedByTeamId ? (
                            <>Picked by <span className="font-semibold" style={{ color: accentOf(view.pickedByTeamId) }}>{names[view.pickedByTeamId] ?? 'TBD'}</span></>
                        ) : (
                            <span className={cn('font-semibold', PICK_BAN_TONES.gold.text)}>{view.pickLabel}</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    )

    if (!view.played) {
        return (
            <div className="flex flex-col gap-2 rounded-lg border border-hairline/10 bg-hairline/[0.02] p-2.5 opacity-60 sm:flex-row sm:items-center sm:justify-between">
                {head}
                <span className="text-xs italic text-muted-foreground">{view.notPlayedText}</span>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-2.5 rounded-lg border border-hairline/10 bg-hairline/[0.02] p-2.5">
            <div className="flex min-w-0 items-center justify-between gap-2.5">
                {head}
                {view.score && (
                    <div className="flex shrink-0 items-center gap-2">
                        <span className="text-2xl font-black leading-none tabular-nums text-foreground">{view.score}</span>
                        {view.result && <ResultBadge result={view.result} />}
                    </div>
                )}
            </div>
            <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
                <SideRuns label={teamName} accent={accentOf(teamId)} runs={map.runs_for} side={view.sides.for} own />
                <SideRuns label={opponentName} runs={map.runs_against} side={view.sides.against} own={false} />
            </div>
        </div>
    )
}
