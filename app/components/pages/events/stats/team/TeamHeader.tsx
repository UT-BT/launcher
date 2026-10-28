import { Fragment, useState } from 'react'
import { Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { SCREENSHOT_SIZE_PX, derivedScreenshotUrl } from '@/app/utils/mapScreenshots'
import { pathParts, recordsHeldView } from '@/app/components/pages/events/stats/statsView'
import type { EventStatsTeam } from '@/app/utils/api'
import { StandingChip, TeamAvatars } from './teamShared'

function Backdrop({ mapName }: { mapName: string }) {
    const [failed, setFailed] = useState<string | null>(null)
    if (failed === mapName) return null

    return (
        <img
            src={derivedScreenshotUrl(mapName, SCREENSHOT_SIZE_PX.card)}
            alt=""
            aria-hidden
            width={SCREENSHOT_SIZE_PX.card}
            height={SCREENSHOT_SIZE_PX.card}
            decoding="async"
            onError={() => setFailed(mapName)}
            className="absolute inset-0 -z-10 size-full scale-125 object-cover opacity-40 blur-2xl"
        />
    )
}

export function TeamHeader({ team, accent, backdropMap }: {
    team: EventStatsTeam
    accent: string
    backdropMap: string | null
}) {
    const path = pathParts(team.path)
    const records = recordsHeldView(team.records_held)

    return (
        <section aria-label={`${team.name} team`} className="relative isolate overflow-hidden rounded-xl border border-hairline/15">
            {backdropMap && <Backdrop mapName={backdropMap} />}
            <div
                aria-hidden
                className="absolute inset-0 -z-10"
                style={{
                    background: `linear-gradient(90deg, var(--card) 30%, color-mix(in oklab, var(--card) 70%, transparent) 60%, color-mix(in oklab, ${accent} 24%, transparent))`,
                }}
            />
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-6">
                <TeamAvatars members={team.members} accent={accent} size="lg" />
                <div className="min-w-0">
                    <h1 className="text-4xl font-black leading-none text-foreground break-words">
                        {team.name}
                    </h1>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                        <StandingChip standing={team.standing} />
                        {records && (
                            <span
                                title={records.title}
                                className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-semibold text-yellow-300"
                            >
                                <Timer className="size-3.5" aria-hidden />
                                {records.label}
                            </span>
                        )}
                        <span className="text-muted-foreground">
                            {team.seed === null ? 'Unseeded' : (
                                <>Pre-cup seed <b className="font-mono tabular-nums text-foreground">{team.seed}</b></>
                            )}
                        </span>
                        {path.length > 0 && (
                            <span className="inline-flex flex-wrap items-center gap-1.5 font-semibold" aria-label="Path">
                                {path.map((part, index) => (
                                    <Fragment key={`${part.label}-${index}`}>
                                        {index > 0 && <span aria-hidden className="text-muted-foreground">→</span>}
                                        <span className={cn(
                                            'rounded-md border px-2 py-0.5 text-xs',
                                            part.next
                                                ? 'border-dashed border-hairline/30 text-muted-foreground'
                                                : 'border-hairline/10 bg-hairline/10 text-foreground',
                                        )}>
                                            {part.next && <span className="sr-only">Next: </span>}
                                            {part.label}
                                        </span>
                                    </Fragment>
                                ))}
                            </span>
                        )}
                    </div>
                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2" aria-label="Players">
                        {team.members.map(member => (
                            <li key={member.user} className="flex min-w-0 items-center gap-1.5">
                                <PlayerInfo userId={member.user} alias={member.alias} size="sm" />
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </section>
    )
}
