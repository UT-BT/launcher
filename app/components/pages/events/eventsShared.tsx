import { cn } from '@/lib/utils'
import type { EventStatus, EventSummary } from '@/app/utils/api'

const STATUS_STYLES: Record<EventStatus, string> = {
    draft: 'bg-white/5 text-muted-foreground border-white/10',
    announced: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    signups_open: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    signups_closed: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    active: 'bg-accent-500/15 text-accent-300 border-accent-500/30',
    completed: 'bg-white/5 text-muted-foreground border-white/10',
    archived: 'bg-white/5 text-muted-foreground border-white/10',
}

const STATUS_LABELS: Record<EventStatus, string> = {
    draft: 'Draft',
    announced: 'Announced',
    signups_open: 'Signups Open',
    signups_closed: 'Signups Closed',
    active: 'In Progress',
    completed: 'Completed',
    archived: 'Archived',
}

export function eventStatusLabel(event: Pick<EventSummary, 'status' | 'signups_open'>): string {
    if (event.signups_open) return STATUS_LABELS.signups_open
    return STATUS_LABELS[event.status] ?? event.status
}

export function EventStatusBadge({ event, className }: { event: Pick<EventSummary, 'status' | 'signups_open'>; className?: string }) {
    const styleKey: EventStatus = event.signups_open ? 'signups_open' : event.status
    return (
        <span className={cn(
            'text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap',
            STATUS_STYLES[styleKey] ?? STATUS_STYLES.draft,
            className,
        )}>
            {eventStatusLabel(event)}
        </span>
    )
}

export function formatEventDate(iso: string | null | undefined): string | null {
    if (!iso) return null
    const date = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatEventDateTime(iso: string | null | undefined): string | null {
    if (!iso) return null
    const date = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatTeamSize(teamSize: number): string {
    return teamSize > 1 ? `${teamSize}v${teamSize}` : '1v1'
}

export const BROWSER_TIMEZONE = (() => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
    } catch {
        return ''
    }
})()
