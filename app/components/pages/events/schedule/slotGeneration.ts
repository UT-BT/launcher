import type { EventStageKind, ResolvedWindow } from '@/app/utils/api'
import { parseApiInstant, startOfNextZonedDay, zonedDayKey } from '@/app/utils/timezone'

export const MAX_PROPOSAL_SLOTS = 5
export const MIN_LEAD_HOURS = 2
export const SLOT_BOUNDARY_MINUTES = 15
export const UNBOUNDED_WINDOW_HORIZON_DAYS = 14

const SLOT_BOUNDARY_MS = SLOT_BOUNDARY_MINUTES * 60_000
const MIN_LEAD_MS = MIN_LEAD_HOURS * 60 * 60_000
const UNBOUNDED_WINDOW_HORIZON_MS = UNBOUNDED_WINDOW_HORIZON_DAYS * 24 * 60 * 60_000

export const DEFAULT_MATCH_DURATION_MINUTES_BY_KIND: Record<EventStageKind, number> = {
    groups: 75,
    swiss: 60,
    single_elim: 60,
}

export function effectiveMatchDurationMinutes(
    stage: { kind: EventStageKind; expected_match_duration_minutes: number | null },
): number {
    return stage.expected_match_duration_minutes ?? DEFAULT_MATCH_DURATION_MINUTES_BY_KIND[stage.kind]
}

function ceilToSlotBoundary(instant: number): number {
    const remainder = instant % SLOT_BOUNDARY_MS
    return remainder === 0 ? instant : instant + (SLOT_BOUNDARY_MS - remainder)
}

export interface PickerBounds {
    minMs: number
    maxMs: number | null
}

export function pickerBounds(window: ResolvedWindow, durationMinutes: number, now: number): PickerBounds {
    const opensAt = parseApiInstant(window.opens_at)
    const closesAt = parseApiInstant(window.closes_at)
    const leadFloor = ceilToSlotBoundary(now + MIN_LEAD_MS)

    return {
        minMs: Math.max(opensAt ?? -Infinity, leadFloor),
        maxMs: closesAt === null ? null : closesAt - durationMinutes * 60_000,
    }
}

export type SlotUnavailableReason = 'outside_window' | 'off_boundary' | 'inside_lead_time' | 'conflicts_with_booking'
export type SlotAvailability = { available: true } | { available: false; reason: SlotUnavailableReason }

export interface BookedWindow {
    starts_at: string
    ends_at: string
}

function overlapsAny(slotStart: number, slotEnd: number, booked: BookedWindow[]): boolean {
    return booked.some(entry => {
        const bookedStart = parseApiInstant(entry.starts_at)
        const bookedEnd = parseApiInstant(entry.ends_at)
        return bookedStart !== null && bookedEnd !== null && slotStart < bookedEnd && bookedStart < slotEnd
    })
}

export function slotAvailability(
    slotStart: number,
    window: ResolvedWindow,
    durationMinutes: number,
    now: number,
    bookedByTeamA: BookedWindow[],
    bookedByTeamB: BookedWindow[],
): SlotAvailability {
    if (slotStart % SLOT_BOUNDARY_MS !== 0) return { available: false, reason: 'off_boundary' }

    const opensAt = parseApiInstant(window.opens_at)
    const closesAt = parseApiInstant(window.closes_at)

    if ((opensAt !== null && slotStart < opensAt) || (closesAt !== null && slotStart > closesAt)) {
        return { available: false, reason: 'outside_window' }
    }

    if (slotStart < now + MIN_LEAD_MS) return { available: false, reason: 'inside_lead_time' }

    const slotEnd = slotStart + durationMinutes * 60_000

    if (overlapsAny(slotStart, slotEnd, bookedByTeamA) || overlapsAny(slotStart, slotEnd, bookedByTeamB)) {
        return { available: false, reason: 'conflicts_with_booking' }
    }

    return { available: true }
}

export interface CandidateSlot {
    startsAt: number
    availability: SlotAvailability
}

export interface CandidateDay {
    key: string
    startsAt: number
    slots: CandidateSlot[]
    availableCount: number
}

export function candidateDays(
    window: ResolvedWindow,
    durationMinutes: number,
    now: number,
    bookedByTeamA: BookedWindow[],
    bookedByTeamB: BookedWindow[],
    timezone: string,
): CandidateDay[] {
    const { minMs, maxMs } = pickerBounds(window, durationMinutes, now)
    const start = ceilToSlotBoundary(minMs)
    const end = maxMs ?? start + UNBOUNDED_WINDOW_HORIZON_MS
    const days: CandidateDay[] = []

    let cursor = start
    while (cursor <= end) {
        const dayEnd = startOfNextZonedDay(cursor, timezone)
        const slots: CandidateSlot[] = []

        for (let at = cursor; at <= end && at < dayEnd; at += SLOT_BOUNDARY_MS) {
            slots.push({
                startsAt: at,
                availability: slotAvailability(at, window, durationMinutes, now, bookedByTeamA, bookedByTeamB),
            })
        }

        days.push({
            key: zonedDayKey(cursor, timezone),
            startsAt: cursor,
            slots,
            availableCount: slots.filter(slot => slot.availability.available).length,
        })
        cursor = Math.max(ceilToSlotBoundary(dayEnd), cursor + SLOT_BOUNDARY_MS)
    }

    return days
}
