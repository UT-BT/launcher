import { cn } from '@/lib/utils'
import { formatCapTime } from '@/app/utils/format'
import { CapTimeLink } from '@/app/components/shared/CapTimeLink'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { MapNavLink } from '@/app/components/shared/MapNavLink'
import type {
    EventBracketStage, EventBracketTeamRef, EventEntrantStatus, EventMatch, EventMatchMap,
    EventMatchStatus, EventSide, EventStageKind, EventStageStatus,
} from '@/app/utils/api'

export const MATCH_STATUS_LABELS: Record<EventMatchStatus, string> = {
    pending: 'Not played',
    scheduled: 'Scheduled',
    live: 'Live',
    complete: 'Final',
    bye: 'Bye',
    forfeit: 'Forfeit',
    cancelled: 'Cancelled',
}

export const DRAW_STYLE = 'bg-amber-500/15 text-amber-300 border-amber-500/30'

export const MATCH_STATUS_STYLES: Record<EventMatchStatus, string> = {
    pending: 'bg-white/5 text-muted-foreground border-white/10',
    scheduled: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    live: 'bg-red-500/15 text-red-300 border-red-500/30',
    complete: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    bye: 'bg-white/5 text-muted-foreground border-white/10',
    forfeit: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    cancelled: 'bg-white/5 text-muted-foreground border-white/10',
}

export const STAGE_STATUS_LABELS: Record<EventStageStatus, string> = {
    pending: 'Not drawn',
    active: 'In progress',
    complete: 'Complete',
}

export const STAGE_KIND_LABELS: Record<EventStageKind, string> = {
    groups: 'Group stage',
    swiss: 'Record bracket',
    single_elim: 'Single elimination',
}

export const ENTRANT_STATUS_STYLES: Record<EventEntrantStatus, string> = {
    active: 'bg-white/5 text-muted-foreground border-white/10',
    qualified: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    eliminated: 'bg-red-500/10 text-red-300/80 border-red-500/20',
}

export const RELAXED_LABELS: Record<string, string> = {
    avoid_rematch: 'a repeat matchup',
    avoid_same_history: 'identical match histories',
    avoid_same_group: 'a same-group matchup',
}

export function teamLabel(team: EventBracketTeamRef | null | undefined, fallback?: string | null): string {
    return team?.name || fallback || 'TBD'
}

export function isDecided(match: EventMatch): boolean {
    return match.status === 'complete' || match.status === 'forfeit' || match.status === 'bye'
}

export function sideOf(match: EventMatch, teamId: string | null | undefined): EventSide | null {
    if (!teamId) return null
    if (match.team_a?.id === teamId) return 'a'
    if (match.team_b?.id === teamId) return 'b'
    return null
}

/** Only maps somebody actually played — the rest are empty slots. */
export function playedMaps(maps: EventMatchMap[] | undefined): EventMatchMap[] {
    return (maps ?? []).filter(row => row.map || row.caps_a != null || row.caps_b != null || row.winner_side)
}

export function stageRounds(stage: EventBracketStage): number[] {
    return [...new Set(stage.matches.map(match => match.round_no))].sort((a, b) => a - b)
}

export function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
        <span className={cn(
            'shrink-0 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border',
            className,
        )}>
            {children}
        </span>
    )
}

export function MatchStatusChip({ match }: { match: Pick<EventMatch, 'status' | 'is_draw'> }) {
    if (match.is_draw) return <Chip className={DRAW_STYLE}>Draw</Chip>

    return <Chip className={MATCH_STATUS_STYLES[match.status]}>{MATCH_STATUS_LABELS[match.status]}</Chip>
}

function TeamRow({ team, fallback, score, won, decided }: {
    team: EventBracketTeamRef | null
    fallback: string | null
    score: number | null
    won: boolean
    decided: boolean
}) {
    const known = !!team?.name

    return (
        <div className="flex items-baseline gap-2 min-w-0">
            <span className={cn(
                'truncate text-sm',
                !known && 'italic text-muted-foreground',
                won ? 'text-white font-semibold' : decided ? 'text-muted-foreground' : 'text-foreground',
            )}>
                {teamLabel(team, fallback)}
            </span>
            {team?.seed != null && (
                <span className="shrink-0 text-[10px] text-muted-foreground/70 tabular-nums">#{team.seed}</span>
            )}
            <span className={cn(
                'ml-auto shrink-0 text-sm tabular-nums',
                won ? 'text-white font-semibold' : 'text-muted-foreground',
            )}>
                {score ?? (decided ? 0 : '–')}
            </span>
        </div>
    )
}

function MapRow({ row, capsToWin, onMapSelect }: {
    row: EventMatchMap
    capsToWin: number
    onMapSelect?: (mapName: string) => void
}) {
    const winner = row.winner_side
        ?? (row.caps_a != null && row.caps_a >= capsToWin ? 'a'
            : row.caps_b != null && row.caps_b >= capsToWin ? 'b' : null)

    return (
        <div className="flex items-center gap-2 text-[11px] min-w-0">
            <span className="text-muted-foreground/60 tabular-nums shrink-0">{row.ordinal + 1}</span>
            <span className="min-w-0 truncate">
                {row.map ? (
                    <MapNavLink mapName={row.map} onMapSelect={onMapSelect} className="text-muted-foreground hover:text-white">
                        {row.map}
                    </MapNavLink>
                ) : (
                    <span className="text-muted-foreground/60 italic">{row.kind === 'decider' ? 'Decider' : 'Map not recorded'}</span>
                )}
            </span>
            {row.kind === 'decider' && row.map && (
                <span className="shrink-0 text-[10px] text-accent-300/80">decider</span>
            )}
            <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                <span className={cn(winner === 'a' && 'text-white font-medium')}>{row.caps_a ?? '–'}</span>
                {' – '}
                <span className={cn(winner === 'b' && 'text-white font-medium')}>{row.caps_b ?? '–'}</span>
            </span>
        </div>
    )
}

function CapList({ row }: { row: EventMatchMap }) {
    if (!row.caps?.length) return null

    return (
        <div className="pl-5 space-y-0.5">
            {row.caps.map(cap => (
                <div key={cap.cap_id} className="flex items-center gap-2 text-[11px] min-w-0">
                    <Chip className={cap.side === 'a'
                        ? 'bg-accent-500/15 text-accent-300 border-accent-500/30'
                        : 'bg-sky-500/15 text-sky-300 border-sky-500/30'}>
                        {cap.side}
                    </Chip>
                    <PlayerInfo userId={cap.user} alias={cap.alias} size="sm" />
                    {cap.cap_time_seconds != null && (
                        <CapTimeLink
                            capId={cap.cap_id}
                            seconds={cap.cap_time_seconds}
                            className="ml-auto shrink-0 tabular-nums text-muted-foreground"
                        />
                    )}
                </div>
            ))}
        </div>
    )
}

export interface MatchCardProps {
    match: EventMatch
    showMaps?: boolean
    showCaps?: boolean
    onClick?: () => void
    onMapSelect?: (mapName: string) => void
    className?: string
    footer?: React.ReactNode
}

export function MatchCard({ match, showMaps = true, showCaps = false, onClick, onMapSelect, className, footer }: MatchCardProps) {
    const decided = isDecided(match)
    const winnerSide = sideOf(match, match.winner_team_id)
    const maps = showMaps ? playedMaps(match.maps) : []

    return (
        <div
            onClick={onClick}
            className={cn(
                'rounded-lg border border-white/10 bg-card/40 p-2.5 space-y-1.5',
                onClick && 'cursor-pointer hover:border-white/20 hover:bg-card/60 transition-colors',
                className,
            )}
        >
            <div className="space-y-1">
                <TeamRow
                    team={match.team_a}
                    fallback={match.slot_a_label}
                    score={match.score_a}
                    won={winnerSide === 'a'}
                    decided={decided && !match.is_draw}
                />
                <TeamRow
                    team={match.team_b}
                    fallback={match.slot_b_label}
                    score={match.score_b}
                    won={winnerSide === 'b'}
                    decided={decided && !match.is_draw}
                />
            </div>

            {maps.length > 0 && (
                <div className="pt-1.5 border-t border-white/5 space-y-1">
                    {maps.map(row => (
                        <div key={row.id} className="space-y-0.5">
                            <MapRow row={row} capsToWin={match.caps_to_win} onMapSelect={onMapSelect} />
                            {showCaps && <CapList row={row} />}
                        </div>
                    ))}
                </div>
            )}

            {(match.status !== 'pending' || match.scheduled_at || footer) && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    {match.status !== 'pending' && <MatchStatusChip match={match} />}
                    {match.scheduled_at && match.status !== 'complete' && (
                        <span className="text-[11px] text-muted-foreground">{formatMatchTime(match.scheduled_at)}</span>
                    )}
                    {footer}
                </div>
            )}
        </div>
    )
}

export function formatMatchTime(iso: string | null): string {
    if (!iso) return ''
    const date = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatSeconds(seconds: number | null): string {
    return seconds == null ? '—' : formatCapTime(seconds)
}
