import type { ReactNode } from 'react'
import { CalendarClock, UserPlus } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { LiveDot } from '@/app/components/shared/LiveDot'
import { formatSlotTime, useDisplayTimezone } from '@/app/utils/timezone'
import type { MyPickBanSession, ScheduleEntry } from '@/app/utils/api'
import type { EventTodo } from '@/app/utils/eventAttention'
import { opponentNameOf } from './bracket/bracketShared'
import { matchRoundLabel } from './schedule/scheduleSections'
import { PickBanLink } from './pickban/components/PickBanLink'

const LOBBY_TITLES: Record<MyPickBanSession['status'], (opponent: string) => string> = {
    lobby: opponent => `Your Picks & Bans lobby vs ${opponent} is open`,
    running: opponent => `Your Picks & Bans vs ${opponent} are live`,
    paused: opponent => `Your Picks & Bans vs ${opponent} are paused`,
}

function TodoRow({ marker, title, detail, action }: {
    marker: ReactNode
    title: string
    detail?: string | null
    action: ReactNode
}) {
    return (
        <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 first:pt-0 last:pb-0">
            <span className="flex size-4 shrink-0 items-center justify-center">{marker}</span>
            <div className="min-w-40 flex-1">
                <p className="text-sm text-foreground">{title}</p>
                {detail && <p className="text-[11px] text-muted-foreground">{detail}</p>}
            </div>
            <div className="ml-auto shrink-0">{action}</div>
        </li>
    )
}

function scheduleDetail(entry: ScheduleEntry, timezone: string): string {
    const round = matchRoundLabel(entry.match)
    const closesAt = entry.slot_window.closes_at
    return closesAt ? `${round} · Scheduling closes ${formatSlotTime(closesAt, timezone)}` : round
}

export function EventTodoPanel({ eventSlug, todos, pickBanSession, pickBanOpponent, myTeamId, onOpenScheduler, onOpenInvitations }: {
    eventSlug: string
    todos: EventTodo[]
    pickBanSession: MyPickBanSession | null
    pickBanOpponent: string | null
    myTeamId: string | null
    onOpenScheduler: (matchId: string) => void
    onOpenInvitations: () => void
}) {
    const timezone = useDisplayTimezone()

    if (todos.length === 0 && !pickBanSession) return null

    return (
        <section aria-label="Needs your attention" className="shrink-0 rounded-lg border border-accent-500/25 bg-accent-500/5 p-3 flex flex-col gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-accent-300">Needs your attention</h2>
            <ul className="flex flex-col divide-y divide-white/5">
                {pickBanSession && (
                    <TodoRow
                        marker={<LiveDot />}
                        title={LOBBY_TITLES[pickBanSession.status](pickBanOpponent ?? 'your opponent')}
                        action={
                            <Button asChild size="sm" variant="secondary">
                                <PickBanLink eventSlug={eventSlug} matchId={pickBanSession.match_id}>
                                    {pickBanSession.status === 'lobby' ? 'Join lobby' : 'Open Picks & Bans'}
                                </PickBanLink>
                            </Button>
                        }
                    />
                )}
                {todos.map(todo => {
                    if (todo.kind === 'invitation') {
                        return (
                            <TodoRow
                                key={`invitation-${todo.team.id}`}
                                marker={<UserPlus className="size-4 text-accent-300" />}
                                title={`${todo.team.name} invited you to their team`}
                                action={<Button size="sm" variant="secondary" onClick={onOpenInvitations}>View invitation</Button>}
                            />
                        )
                    }

                    const { entry } = todo
                    const opponent = opponentNameOf(entry.match, myTeamId) ?? 'your opponent'
                    const answering = todo.kind === 'answer-times'
                    return (
                        <TodoRow
                            key={`${todo.kind}-${entry.match.id}`}
                            marker={<CalendarClock className="size-4 text-accent-300" />}
                            title={answering ? `${opponent} offered times for your match` : `Your match vs ${opponent} needs a time`}
                            detail={scheduleDetail(entry, timezone)}
                            action={
                                <Button size="sm" variant="secondary" onClick={() => onOpenScheduler(entry.match.id)}>
                                    {answering ? 'Respond to offer' : 'Propose a time'}
                                </Button>
                            }
                        />
                    )
                })}
            </ul>
        </section>
    )
}
