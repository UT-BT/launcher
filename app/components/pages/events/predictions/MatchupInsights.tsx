import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { MapNavLink } from '@/app/components/shared/MapNavLink'
import {
    fetchEventPredictionInsights,
    type PredictionFormEntry, type PredictionMatchup, type PredictionTeamInsight,
} from '@/app/utils/api'

const MAP_LIMIT = 4

const OUTCOME_STYLES: Record<string, string> = {
    win: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    loss: 'bg-red-500/15 text-red-300/90 border-red-500/25',
    draw: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
}

const OUTCOME_LETTERS: Record<string, string> = { win: 'W', loss: 'L', draw: 'D' }

/**
 * Everything here comes from matches already played in this event. Cup teams are
 * event entities, so there is no record for them outside it — a team-stats
 * feature spanning events is separate work, and this is the part that actually
 * informs a prediction.
 */
export function MatchupInsights({ accessToken, slug, matchId, onMapSelect }: {
    accessToken: string
    slug: string
    matchId: string
    onMapSelect?: (mapName: string) => void
}) {
    const [data, setData] = useState<PredictionMatchup | null>(null)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        const controller = new AbortController()
        setFailed(false)
        fetchEventPredictionInsights(accessToken, slug, matchId, controller.signal)
            .then(setData)
            .catch(() => { if (!controller.signal.aborted) setFailed(true) })

        return () => controller.abort()
    }, [accessToken, slug, matchId])

    if (failed) {
        return <p className="text-xs text-muted-foreground">Could not load the matchup.</p>
    }

    if (!data) {
        return <p className="text-xs text-muted-foreground">Loading matchup…</p>
    }

    if (!data.available || !data.team_a || !data.team_b) {
        return (
            <p className="text-xs text-muted-foreground">
                Neither side has played yet in this event, so there is nothing to compare.
            </p>
        )
    }

    const h2h = data.head_to_head

    return (
        <div className="flex flex-col gap-3">
            {h2h && h2h.played > 0 && (
                <div className="text-xs">
                    <span className="text-muted-foreground">Met before in this event: </span>
                    <span className="text-white/90 tabular-nums">
                        {h2h.record.win}–{h2h.record.loss}
                        {h2h.record.draw > 0 && `–${h2h.record.draw}`}
                    </span>
                    <span className="text-muted-foreground"> to {data.team_a.name}</span>
                </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
                <TeamColumn team={data.team_a} onMapSelect={onMapSelect} />
                <TeamColumn team={data.team_b} onMapSelect={onMapSelect} align="right" />
            </div>
        </div>
    )
}

function TeamColumn({ team, align, onMapSelect }: {
    team: PredictionTeamInsight
    align?: 'right'
    onMapSelect?: (mapName: string) => void
}) {
    const played = team.record.win + team.record.loss + team.record.draw

    return (
        <div className={cn('min-w-0 flex flex-col gap-2', align === 'right' && 'sm:items-end')}>
            <div className={cn('min-w-0', align === 'right' && 'sm:text-right')}>
                <div className="text-sm font-medium text-white truncate">{team.name}</div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                    {played === 0 ? 'No matches yet' : (
                        <>
                            {team.record.win}W {team.record.loss}L
                            {team.record.draw > 0 && ` ${team.record.draw}D`}
                        </>
                    )}
                </div>
            </div>

            {team.form.length > 0 && (
                <div className={cn('flex items-center gap-1', align === 'right' && 'sm:flex-row-reverse')}>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Form</span>
                    {team.form.map(entry => <FormPip key={entry.match_id} entry={entry} />)}
                </div>
            )}

            {team.maps.length > 0 && (
                <div className={cn('w-full flex flex-col gap-0.5', align === 'right' && 'sm:items-end')}>
                    {team.maps.slice(0, MAP_LIMIT).map(record => (
                        <div
                            key={record.map}
                            className={cn(
                                'w-full flex items-center gap-2 text-[11px] min-w-0',
                                align === 'right' && 'sm:flex-row-reverse',
                            )}
                        >
                            <MapNavLink
                                mapName={record.map}
                                onMapSelect={onMapSelect}
                                className="truncate text-muted-foreground hover:text-white"
                            >
                                {record.map}
                            </MapNavLink>
                            <span className="shrink-0 tabular-nums text-white/70">
                                {record.won}–{record.lost}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function FormPip({ entry }: { entry: PredictionFormEntry }) {
    const outcome = entry.outcome ?? 'draw'
    const score = entry.score !== null && entry.opponent_score !== null
        ? ` ${entry.score}–${entry.opponent_score}`
        : ''

    return (
        <span
            title={`${entry.opponent ?? 'Unknown'}${score}${entry.round_label ? ` · ${entry.round_label}` : ''}`}
            className={cn(
                'size-4 shrink-0 rounded border grid place-items-center text-[9px] font-bold cursor-help',
                OUTCOME_STYLES[outcome],
            )}
        >
            {OUTCOME_LETTERS[outcome]}
        </span>
    )
}
