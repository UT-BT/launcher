import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Bell, RefreshCw, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { Tooltip } from '@/app/components/ui/tooltip'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { IS_WEB } from '@/app/platform/target'
import { useNavigation } from './NavigationContext'
import { usePageRefresh } from './PageRefreshContext'
import type { InboxNotification, UserProfile } from '@/app/utils/api'
import { deletePrototypeNotification, fetchPrototypeInbox, markPrototypeInboxRead } from '@/app/utils/birthdayPrototype'

export function NavHistoryBar({ userProfile }: { userProfile?: UserProfile }) {
    const { back, forward, canBack, canForward } = useNavigation()
    const refresh = usePageRefresh()
    const r = refresh?.display
    const [inboxOpen, setInboxOpen] = useState(false)
    const [notifications, setNotifications] = useState<InboxNotification[]>([])
    const inboxRef = useRef<HTMLDivElement>(null)

    const loadInbox = useCallback(() => {
        if (userProfile?.accessToken) setNotifications(fetchPrototypeInbox())
    }, [userProfile?.accessToken])

    useEffect(() => { loadInbox() }, [loadInbox])

    useEffect(() => {
        if (!inboxOpen) return
        const closeOnOutsidePointer = (event: PointerEvent) => {
            if (!inboxRef.current?.contains(event.target as Node)) setInboxOpen(false)
        }
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setInboxOpen(false)
        }
        document.addEventListener('pointerdown', closeOnOutsidePointer)
        document.addEventListener('keydown', closeOnEscape)
        return () => {
            document.removeEventListener('pointerdown', closeOnOutsidePointer)
            document.removeEventListener('keydown', closeOnEscape)
        }
    }, [inboxOpen])

    const sortedNotifications = useMemo(
        () => [...notifications].sort((a, b) => b.created_at.localeCompare(a.created_at)),
        [notifications],
    )
    const unreadCount = notifications.filter(item => !item.read_at).length

    const toggleInbox = () => {
        const next = !inboxOpen
        if (next) setNotifications(markPrototypeInboxRead())
        setInboxOpen(next)
    }

    const removeNotification = (id: string) => {
        setNotifications(deletePrototypeNotification(id))
    }

    return (
        <div className="flex items-center justify-between gap-1 mb-3 -ml-1 min-h-8">
            <div className="flex items-center gap-1">
                {!IS_WEB && (<>
                <Tooltip content="Back" side="bottom">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={back}
                        disabled={!canBack}
                        aria-label="Back"
                        className={cn('size-8 text-muted-foreground hover:text-foreground', !canBack && 'opacity-30')}
                    >
                        <ArrowLeft className="size-4" />
                    </Button>
                </Tooltip>
                <Tooltip content="Forward" side="bottom">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={forward}
                        disabled={!canForward}
                        aria-label="Forward"
                        className={cn('size-8 text-muted-foreground hover:text-foreground', !canForward && 'opacity-30')}
                    >
                        <ArrowRight className="size-4" />
                    </Button>
                </Tooltip>
                </>)}
            </div>

            <div className="flex items-center gap-1">
                {userProfile && (
                    <div ref={inboxRef} className="relative">
                        <Tooltip content="Notifications" side="bottom">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleInbox}
                                aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                                aria-expanded={inboxOpen}
                                className="relative size-8 text-muted-foreground hover:text-foreground"
                            >
                                <Bell className="size-4" />
                                {unreadCount > 0 && (
                                    <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[9px] font-bold text-white tabular-nums">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </Button>
                        </Tooltip>
                        {inboxOpen && (
                            <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] max-h-80 overflow-y-auto rounded-xl border border-border bg-card/98 p-1.5 shadow-2xl">
                                {sortedNotifications.length === 0 ? (
                                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">No notifications.</div>
                                ) : sortedNotifications.map(item => (
                                    <div key={item.id} className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-hairline/5">
                                        <span className="text-xl" aria-hidden>{item.emoji ?? '🔔'}</span>
                                        <div className="min-w-0 flex-1">
                                            {item.actor_user_id ? (
                                                <PlayerInfo userId={item.actor_user_id} alias={item.actor_alias} title={item.actor_title} size="sm" />
                                            ) : <span className="text-xs font-medium text-foreground">UTBT</span>}
                                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                                {item.type === 'birthday_greeting' ? 'Sent you a birthday greeting' : 'Sent you a notification'} · {new Date(item.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeNotification(item.id)}
                                            aria-label="Delete notification"
                                            className="size-7 shrink-0 text-muted-foreground opacity-60 hover:text-red-400 group-hover:opacity-100"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {r?.active && (
                    <Tooltip content={r.tooltip ?? 'Refresh'} side="bottom">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => refresh?.trigger()}
                            disabled={r.refreshing || r.disabled}
                            aria-label="Refresh"
                            className="size-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                            <RefreshCw className={cn('size-4', r.refreshing && 'animate-spin')} />
                        </Button>
                    </Tooltip>
                )}
            </div>
        </div>
    )
}
