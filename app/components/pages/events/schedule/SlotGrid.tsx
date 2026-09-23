import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatZoned, zonedDayKey, zonedParts } from '@/app/utils/timezone'
import type { CandidateDay, SlotAvailability, SlotUnavailableReason } from './slotGeneration'

const DAYS_PER_PAGE = 7

const SHORT_REASON_LABELS: Record<SlotUnavailableReason, string> = {
    outside_window: 'Outside window',
    off_boundary: 'Off the 15-minute mark',
    inside_lead_time: 'Too soon',
    conflicts_with_booking: 'Clashes with a booked match',
}

export interface SelectedSlot {
    startsAt: number
    availability: SlotAvailability
}

interface SlotGridProps {
    days: CandidateDay[]
    selected: SelectedSlot[]
    max: number
    timezone: string
    onToggle: (startsAt: number) => void
}

export function SlotGrid({ days, selected, max, timezone, onToggle }: SlotGridProps) {
    const [dayKey, setDayKey] = useState<string | null>(null)
    const [quarterHours, setQuarterHours] = useState(false)

    const firstOpenKey = days.find(day => day.availableCount > 0)?.key ?? null
    const activeKey = dayKey && days.some(day => day.key === dayKey) ? dayKey : firstOpenKey
    const activeIndex = days.findIndex(day => day.key === activeKey)
    const activeDay = activeIndex >= 0 ? days[activeIndex] : null

    const [pinnedPage, setPinnedPage] = useState<number | null>(null)
    const page = pinnedPage ?? Math.floor(Math.max(activeIndex, 0) / DAYS_PER_PAGE)

    const selectDay = (key: string) => {
        setDayKey(key)
        setPinnedPage(null)
    }

    const pageCount = Math.max(1, Math.ceil(days.length / DAYS_PER_PAGE))
    const pageDays = days.slice(page * DAYS_PER_PAGE, (page + 1) * DAYS_PER_PAGE)

    const selectedSet = useMemo(() => new Set(selected.map(slot => slot.startsAt)), [selected])
    const selectedPerDay = useMemo(() => {
        const counts = new Map<string, number>()
        for (const slot of selected) {
            const key = zonedDayKey(slot.startsAt, timezone)
            counts.set(key, (counts.get(key) ?? 0) + 1)
        }
        return counts
    }, [selected, timezone])

    const visibleSlots = useMemo(() => {
        if (!activeDay) return []
        return activeDay.slots
            .map(slot => ({ ...slot, minute: zonedParts(slot.startsAt, timezone).minute }))
            .filter(slot => quarterHours || slot.minute % 30 === 0 || selectedSet.has(slot.startsAt))
    }, [activeDay, quarterHours, timezone, selectedSet])

    const atLimit = selected.length >= max

    if (days.length === 0) {
        return <p className="text-xs text-muted-foreground">There are no start times left in this match's window.</p>
    }

    const rangeLabel = pageDays.length > 0
        ? `${formatZoned(pageDays[0].startsAt, timezone, { month: 'short', day: 'numeric' })} – ${formatZoned(pageDays[pageDays.length - 1].startsAt, timezone, { month: 'short', day: 'numeric' })}`
        : ''

    return (
        <div className="space-y-3">
            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {selected.map(slot => (
                        <span
                            key={slot.startsAt}
                            title={slot.availability.available ? undefined : SHORT_REASON_LABELS[slot.availability.reason]}
                            className={cn(
                                'inline-flex items-center gap-1 rounded-md border pl-2 pr-1 py-0.5 text-[11px] tabular-nums',
                                slot.availability.available
                                    ? 'border-accent-500/50 bg-accent-500/15 text-accent-200'
                                    : 'border-red-500/50 bg-red-500/10 text-red-300',
                            )}
                        >
                            <button
                                type="button"
                                onClick={() => selectDay(zonedDayKey(slot.startsAt, timezone))}
                                className="cursor-pointer"
                            >
                                {formatZoned(slot.startsAt, timezone, {
                                    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                })}
                                {!slot.availability.available && ` · ${SHORT_REASON_LABELS[slot.availability.reason]}`}
                            </button>
                            <button
                                type="button"
                                aria-label="Remove time"
                                onClick={() => onToggle(slot.startsAt)}
                                className="rounded p-0.5 hover:bg-white/10 cursor-pointer"
                            >
                                <X className="size-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        aria-label="Previous days"
                        disabled={page === 0}
                        onClick={() => setPinnedPage(Math.max(0, page - 1))}
                        className="rounded-md border border-white/10 p-1 text-muted-foreground hover:border-white/25 disabled:opacity-30 cursor-pointer disabled:cursor-default"
                    >
                        <ChevronLeft className="size-3.5" />
                    </button>
                    <span className="flex-1 text-center text-[11px] text-muted-foreground tabular-nums">{rangeLabel}</span>
                    <button
                        type="button"
                        aria-label="Next days"
                        disabled={page >= pageCount - 1}
                        onClick={() => setPinnedPage(Math.min(pageCount - 1, page + 1))}
                        className="rounded-md border border-white/10 p-1 text-muted-foreground hover:border-white/25 disabled:opacity-30 cursor-pointer disabled:cursor-default"
                    >
                        <ChevronRight className="size-3.5" />
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-1">
                    {pageDays.map(day => {
                        const isActive = day.key === activeKey
                        const isEmpty = day.availableCount === 0
                        const pickedCount = selectedPerDay.get(day.key) ?? 0
                        return (
                            <button
                                key={day.key}
                                type="button"
                                disabled={isEmpty}
                                onClick={() => selectDay(day.key)}
                                className={cn(
                                    'relative flex flex-col items-center rounded-md border py-1.5 text-[11px] leading-tight transition-colors',
                                    isActive
                                        ? 'border-accent-500/60 bg-accent-500/20 text-accent-200'
                                        : isEmpty
                                            ? 'border-white/5 text-muted-foreground/40 cursor-not-allowed'
                                            : 'border-white/10 bg-card/40 text-foreground hover:border-white/25 cursor-pointer',
                                )}
                            >
                                <span className="text-[10px] uppercase tracking-wider opacity-70">
                                    {formatZoned(day.startsAt, timezone, { weekday: 'short' })}
                                </span>
                                <span className="text-sm font-medium tabular-nums">
                                    {formatZoned(day.startsAt, timezone, { day: 'numeric' })}
                                </span>
                                {pickedCount > 0 && (
                                    <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-accent-400" />
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {activeDay && (
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">
                            {formatZoned(activeDay.startsAt, timezone, { weekday: 'long', month: 'long', day: 'numeric' })}
                        </span>
                        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                            <input
                                type="checkbox"
                                checked={quarterHours}
                                onChange={event => setQuarterHours(event.target.checked)}
                                style={{ colorScheme: 'dark' }}
                                className="size-3 accent-accent-500 cursor-pointer"
                            />
                            Quarter hours
                        </label>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
                        {visibleSlots.map(slot => {
                            const isSelected = selectedSet.has(slot.startsAt)
                            const unavailable = !slot.availability.available
                            const disabled = !isSelected && (unavailable || atLimit)
                            return (
                                <button
                                    key={slot.startsAt}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => onToggle(slot.startsAt)}
                                    title={slot.availability.available ? undefined : SHORT_REASON_LABELS[slot.availability.reason]}
                                    className={cn(
                                        'rounded-md border py-1.5 text-xs tabular-nums transition-colors',
                                        isSelected
                                            ? 'border-accent-500/60 bg-accent-500/20 text-accent-200 cursor-pointer'
                                            : unavailable
                                                ? 'border-white/5 text-muted-foreground/40 line-through cursor-not-allowed'
                                                : atLimit
                                                    ? 'border-white/5 bg-card/20 text-muted-foreground/60 cursor-not-allowed'
                                                    : 'border-white/10 bg-card/40 text-foreground hover:border-white/25 cursor-pointer',
                                    )}
                                >
                                    {formatZoned(slot.startsAt, timezone, { hour: '2-digit', minute: '2-digit' })}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            <p className="text-[10px] text-muted-foreground/70">Times shown in {timezone}.</p>
        </div>
    )
}
