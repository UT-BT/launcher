import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRegisterPageRefresh } from '@/app/components/navigation/PageRefreshContext'
import { NavLink } from '@/app/components/navigation/NavLink'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { Button } from '@/app/components/ui/button'
import {
    BIRTHDAY_GREETING_EMOJIS,
    type BirthdayGreetingEmoji,
    type CalendarBirthday,
    type CalendarItem,
    type UserProfile,
} from '@/app/utils/api'
import { fetchPrototypeCalendar, sendPrototypeGreeting } from '@/app/utils/birthdayPrototype'
import type { EventsPageCaches, EventsPageState } from './EventsPage.types'

interface EventsPageProps {
    userProfile?: UserProfile
    state: EventsPageState
    onStateChange: (updater: (prev: EventsPageState) => EventsPageState) => void
    caches: EventsPageCaches
    onCachesChange: (updater: (prev: EventsPageCaches) => EventsPageCaches) => void
    onEventSelect: (slug: string) => void
}

function monthBounds(monthKey: string) {
    const [year, month] = monthKey.split('-').map(Number)
    const first = new Date(year, month - 1, 1)
    const last = new Date(year, month, 0)
    const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return { first, last, from: iso(first), to: iso(last) }
}

function moveMonth(monthKey: string, delta: number): string {
    const { first } = monthBounds(monthKey)
    first.setMonth(first.getMonth() + delta)
    return `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}`
}

export function EventsPage({ userProfile, state, onStateChange, onEventSelect }: EventsPageProps) {
    const [items, setItems] = useState<CalendarItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [greetingUser, setGreetingUser] = useState<string | null>(null)
    const [sending, setSending] = useState(false)
    const bounds = useMemo(() => monthBounds(state.month), [state.month])

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            setItems(await fetchPrototypeCalendar(
                userProfile?.accessToken ?? '',
                userProfile?.id,
                userProfile?.alias ?? userProfile?.username,
                bounds.from,
                bounds.to,
            ))
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not load the calendar.')
        } finally {
            setLoading(false)
        }
    }, [bounds.from, bounds.to, userProfile?.accessToken, userProfile?.alias, userProfile?.id, userProfile?.username])

    useEffect(() => { void load() }, [load])
    useEffect(() => {
        const reload = () => void load()
        window.addEventListener('prototype-birthday-changed', reload)
        return () => window.removeEventListener('prototype-birthday-changed', reload)
    }, [load])
    useRegisterPageRefresh({ onRefresh: () => void load(), refreshing: loading, tooltip: 'Refresh calendar' })

    const itemsByDate = useMemo(() => {
        const grouped = new Map<string, CalendarItem[]>()
        for (const item of items) grouped.set(item.date, [...(grouped.get(item.date) ?? []), item])
        return grouped
    }, [items])

    const cells = useMemo(() => {
        const leading = (bounds.first.getDay() + 6) % 7
        return [
            ...Array.from({ length: leading }, () => null),
            ...Array.from({ length: bounds.last.getDate() }, (_, index) => index + 1),
        ]
    }, [bounds.first, bounds.last])

    const greet = useCallback(async (birthday: CalendarBirthday, emoji: BirthdayGreetingEmoji) => {
        if (!userProfile?.accessToken || sending) return
        setSending(true)
        setError(null)
        try {
            const updated = sendPrototypeGreeting(birthday, emoji)
            setItems(current => current.map(item => item.type === 'birthday' && item.user_id === updated.user_id && item.date === updated.date ? updated : item))
            setGreetingUser(null)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not send the birthday greeting.')
        } finally {
            setSending(false)
        }
    }, [sending, userProfile?.accessToken])

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Community Calendar</h1>
                    <p className="mt-0.5 text-xs text-muted-foreground">Events and community birthdays in one place.</p>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onStateChange(prev => ({ ...prev, month: moveMonth(prev.month, -1) }))} aria-label="Previous month"><ChevronLeft /></Button>
                    <div className="min-w-40 text-center text-sm font-semibold">
                        {bounds.first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => onStateChange(prev => ({ ...prev, month: moveMonth(prev.month, 1) }))} aria-label="Next month"><ChevronRight /></Button>
                </div>
            </div>

            {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">{error}</div>}

            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-hairline/10 bg-hairline/10">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <div key={day} className="bg-card px-1 py-2 text-center text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-muted-foreground">{day}</div>
                ))}
                {cells.map((day, index) => {
                    if (day == null) return <div key={`blank-${index}`} className="min-h-24 sm:min-h-32 bg-card/40" />
                    const date = `${state.month}-${String(day).padStart(2, '0')}`
                    const dayItems = itemsByDate.get(date) ?? []
                    return (
                        <div key={date} className="min-h-24 sm:min-h-32 bg-card p-1 sm:p-2">
                            <div className="mb-1 text-[10px] sm:text-xs font-medium text-muted-foreground">{day}</div>
                            <div className="space-y-1">
                                {dayItems.map((item, itemIndex) => item.type === 'event' ? (
                                    <NavLink
                                        key={`event-${item.event.id}-${itemIndex}`}
                                        view="event-detail"
                                        params={{ eventSlug: item.event.slug }}
                                        onActivate={() => onEventSelect(item.event.slug)}
                                        className="block rounded-md border border-accent-500/20 bg-accent-500/10 px-1.5 py-1 text-[10px] sm:text-xs font-medium text-accent-200 hover:bg-accent-500/20 truncate"
                                    >
                                        <CalendarDays className="hidden sm:inline size-3 mr-1" />{item.event.name}
                                    </NavLink>
                                ) : (
                                    <div key={`birthday-${item.user_id}-${itemIndex}`} className="relative">
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setGreetingUser(current => current === item.user_id ? null : item.user_id)}
                                            onKeyDown={event => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault()
                                                    setGreetingUser(current => current === item.user_id ? null : item.user_id)
                                                }
                                            }}
                                            className={cn(
                                                'w-full rounded-md border border-pink-500/20 bg-pink-500/10 px-1.5 py-1 text-left text-[10px] sm:text-xs text-pink-200 hover:bg-pink-500/20 truncate cursor-pointer',
                                                item.greeting_emoji && 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
                                            )}
                                            title={item.greeting_emoji ? `Greeting sent: ${item.greeting_emoji}. Click to change it.` : `Wish ${item.alias ?? 'this player'} a happy birthday`}
                                        >
                                            <span className="flex items-center gap-1 min-w-0">
                                                <span aria-hidden>🎂</span>
                                                <PlayerInfo
                                                    userId={item.user_id}
                                                    alias={item.alias}
                                                    title={item.active_title}
                                                    size="sm"
                                                    interactive={false}
                                                    className="min-w-0 [&_img]:hidden sm:[&_img]:block"
                                                />
                                                {item.greeting_emoji && <span aria-label={`Greeting sent: ${item.greeting_emoji}`}>{item.greeting_emoji}</span>}
                                            </span>
                                        </div>
                                        {greetingUser === item.user_id && (
                                            <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-lg border border-hairline/10 bg-card p-2 shadow-xl">
                                                <PlayerInfo userId={item.user_id} alias={item.alias} title={item.active_title} size="sm" />
                                                {String(userProfile?.id) === item.user_id ? (
                                                    <p className="mt-2 text-xs text-muted-foreground">This is your birthday.</p>
                                                ) : userProfile?.accessToken ? (
                                                    <div className="mt-2 flex gap-1" aria-label="Choose one birthday greeting">
                                                        {BIRTHDAY_GREETING_EMOJIS.map(emoji => (
                                                            <button
                                                                key={emoji}
                                                                type="button"
                                                                disabled={sending}
                                                                onClick={() => void greet(item, emoji)}
                                                                className={cn(
                                                                    'flex size-9 items-center justify-center rounded-md border text-lg hover:bg-hairline/10 disabled:opacity-50',
                                                                    item.greeting_emoji === emoji ? 'border-accent-400 bg-accent-500/15' : 'border-transparent',
                                                                )}
                                                                aria-label={item.greeting_emoji ? `Replace greeting with ${emoji}` : `Send ${emoji}`}
                                                                aria-pressed={item.greeting_emoji === emoji}
                                                            >
                                                                {sending ? <Loader2 className="size-4 animate-spin" /> : emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : <p className="mt-2 text-xs text-muted-foreground">Sign in to send a greeting.</p>}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
            {loading && <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading calendar…</div>}
        </div>
    )
}
