import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { ErrorBanner } from '@/app/components/pages/teams/teamsShared'
import { achievementIcon } from '@/app/components/pages/achievements/achievementIcons'
import { getTitleTextStyle } from '@/app/utils/titleStyles'
import {
    eventErrorMessage, fetchEventAchievementBoard, toActiveTitle,
    type EventAchievementBoard, type EventAchievementBoardEntry, type EventAchievementPlayer,
} from '@/app/utils/api'
import {
    LIST_PREVIEW, awardRule, boardSummary, chaseHint, emptyHoldersText, holdersHeading,
    measureText, measureTone, youLine,
} from './eventAchievementBoard'

export function EventAchievementsTab({ slug, accessToken, viewerId }: {
    slug: string
    accessToken: string
    viewerId?: string
}) {
    const [board, setBoard] = useState<EventAchievementBoard | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const controller = new AbortController()

        fetchEventAchievementBoard(accessToken, slug, controller.signal)
            .then(next => { setBoard(next); setError(null) })
            .catch(e => { if (!controller.signal.aborted) setError(eventErrorMessage(e)) })

        return () => controller.abort()
    }, [accessToken, slug])

    if (!board) {
        return error
            ? <ErrorBanner message={error} />
            : <p className="text-xs text-muted-foreground">Loading achievements…</p>
    }

    return (
        <div className="flex flex-col gap-3">
            <ErrorBanner message={error} />
            <p className="text-xs text-muted-foreground">{boardSummary(board)}</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {board.achievements.map(entry => (
                    <StandingCard key={entry.code} entry={entry} finalised={board.finalised} viewerId={viewerId} />
                ))}
            </div>
        </div>
    )
}

function StandingCard({ entry, finalised, viewerId }: {
    entry: EventAchievementBoardEntry
    finalised: boolean
    viewerId?: string
}) {
    const Icon = achievementIcon(entry.icon)
    const rule = awardRule(entry, finalised)
    const title = toActiveTitle(entry.title)
    const you = youLine(entry, finalised)

    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl flex flex-col overflow-hidden">
            <div className="flex items-start gap-3 px-4 py-3 border-b border-hairline/5">
                <div className="size-9 rounded-lg border border-hairline/5 bg-hairline/5 flex items-center justify-center shrink-0">
                    <Icon className="size-4 text-violet-300" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold text-foreground">{entry.name}</span>
                        {rule && (
                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-violet-500/15 text-violet-300">
                                {rule}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{entry.description}</p>
                    {title && (
                        <div className="text-[11px] text-muted-foreground">
                            Title: <span className="font-semibold" style={getTitleTextStyle(title)}>{title.name}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="px-4 py-3 space-y-3">
                <PlayerList
                    entry={entry}
                    heading={`${holdersHeading(entry, finalised)} · ${entry.qualifying_count.toLocaleString()}`}
                    players={entry.qualifying}
                    empty={emptyHoldersText(entry, finalised)}
                    viewerId={viewerId}
                />
                {entry.chasing.length > 0 && (
                    <PlayerList
                        entry={entry}
                        heading="Chasing"
                        players={entry.chasing}
                        viewerId={viewerId}
                        hints
                    />
                )}
                {you && (
                    <div className="text-xs text-muted-foreground">
                        You: <span className="text-foreground font-medium">{you}</span>
                    </div>
                )}
            </div>
        </div>
    )
}

function PlayerList({ entry, heading, players, empty, viewerId, hints = false }: {
    entry: EventAchievementBoardEntry
    heading: string
    players: EventAchievementPlayer[]
    empty?: string
    viewerId?: string
    hints?: boolean
}) {
    const [expanded, setExpanded] = useState(false)
    const shown = expanded ? players : players.slice(0, LIST_PREVIEW)

    return (
        <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{heading}</div>
            {players.length === 0 ? (
                <p className="text-xs text-muted-foreground">{empty}</p>
            ) : (
                <div role="list" aria-label={heading} className="divide-y divide-hairline/5">
                    {shown.map(player => {
                        const value = measureText(entry, player.value)
                        const tone = measureTone(entry, player.value)
                        const hint = hints ? chaseHint(entry, player) : null

                        return (
                            <div
                                key={player.user_id}
                                role="listitem"
                                className={cn(
                                    'flex items-center justify-between gap-2 min-w-0 py-1.5',
                                    viewerId && player.user_id === viewerId && 'bg-accent-500/[0.06]',
                                )}
                            >
                                <PlayerInfo userId={player.user_id} alias={player.alias} title={toActiveTitle(player.title)} size="sm" />
                                {(value || hint) && (
                                    <div className="shrink-0 text-right">
                                        {value && (
                                            <div className={cn(
                                                'text-xs tabular-nums font-semibold text-foreground',
                                                tone === 'up' && 'text-emerald-300',
                                                tone === 'down' && 'text-red-300',
                                            )}>
                                                {value}
                                            </div>
                                        )}
                                        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
            {players.length > LIST_PREVIEW && (
                <Button size="sm" variant="ghost" onClick={() => setExpanded(value => !value)}>
                    {expanded ? 'Show fewer' : `Show all ${players.length.toLocaleString()}`}
                </Button>
            )}
        </div>
    )
}
