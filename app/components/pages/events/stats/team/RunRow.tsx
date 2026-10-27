import { Fragment } from 'react'
import { Clapperboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NavLink } from '@/app/components/navigation/NavLink'
import { CapTimeLink, openCap, openTeamCap } from '@/app/components/shared/CapTimeLink'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { EMPTY_STAT, runView } from '@/app/components/pages/events/stats/statsView'
import type { EventRun } from '@/app/utils/api'

const ROW = 'flex min-h-7 items-center gap-2 rounded-md px-2 py-0.5'

function ReplayLink({ teamCapId, capId, kind }: { teamCapId: string | null; capId: string | undefined; kind: 'demo' | 'ghost' }) {
    const title = kind === 'demo' ? 'Demo available' : 'Ghost available'
    if (teamCapId) {
        return (
            <NavLink
                view="team-cap-detail"
                params={{ teamCapId }}
                onActivate={() => openTeamCap(teamCapId)}
                title={title}
                ariaLabel="Watch replay"
                className="inline-flex cursor-pointer text-yellow-300 hover:opacity-80"
            >
                <Clapperboard className="size-4" aria-hidden />
            </NavLink>
        )
    }
    if (!capId) return null
    return (
        <NavLink
            view="cap-detail"
            params={{ capId }}
            onActivate={() => openCap(capId)}
            title={title}
            ariaLabel="Watch replay"
            className="inline-flex cursor-pointer text-yellow-300 hover:opacity-80"
        >
            <Clapperboard className="size-4" aria-hidden />
        </NavLink>
    )
}

export function RunRow({ run, own }: { run: EventRun; own: boolean }) {
    const view = runView(run)
    const firstCapId = view.members[0]?.capId

    return (
        <div
            title={view.title}
            className={cn(ROW, own ? 'bg-hairline/5' : 'border border-dashed border-hairline/10')}
        >
            <CapTimeLink
                teamCapId={view.teamCapId}
                capId={firstCapId}
                seconds={run.team_time_seconds}
                className="w-24 shrink-0 font-mono text-[13px] font-semibold tabular-nums text-foreground"
            />
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                {view.members.map((member, index) => (
                    <Fragment key={member.capId}>
                        {index > 0 && <span aria-hidden className="text-xs text-muted-foreground">+</span>}
                        <span title={member.title} className="min-w-0">
                            <PlayerInfo userId={member.user} alias={member.alias} size="sm" presentation="name" />
                        </span>
                    </Fragment>
                ))}
            </span>
            <span className="flex shrink-0 items-center gap-2">
                {view.region && <span className="hidden text-[11px] text-muted-foreground sm:inline">{view.region}</span>}
                {view.replay && <ReplayLink teamCapId={view.teamCapId} capId={firstCapId} kind={view.replay} />}
            </span>
        </div>
    )
}

export function UnrecordedRow({ text }: { text: string }) {
    return (
        <div className={cn(ROW, 'border border-dashed border-hairline/20 text-xs italic text-muted-foreground')}>
            <span aria-hidden className="w-24 shrink-0">{EMPTY_STAT}</span>
            <span>{text}</span>
        </div>
    )
}
