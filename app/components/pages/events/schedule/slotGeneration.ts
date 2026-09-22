import type { EventStageKind, ResolvedWindow } from '@/app/utils/api'
import { parseApiInstant } from '@/app/utils/timezone'

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

function ceilToNextBoundary(instant: number): number {
    const remainder = instant % SLOT_BOUNDARY_MS
    return remainder === 0 ? instant : instant + (SLOT_BOUNDARY_MS - remainder)
}

export interface ResolvedSlotWindow {
    start: number
    end: number
}

export function resolveGenerationWindow(
    window: ResolvedWindow,
    durationMinutes: number,
    now: number,
): ResolvedSlotWindow {
    const opensAt = parseApiInstant(window.opens_at)
    const closesAt = parseApiInstant(window.closes_at)

    const start = Math.max(opensAt ?? -Infinity, ceilToNextBoundary(now))
    const end = closesAt === null
        ? start + UNBOUNDED_WINDOW_HORIZON_MS
        : closesAt - durationMinutes * 60_000

    return { start, end }
}

export function generateCandidateSlots(window: ResolvedWindow, durationMinutes: number, now: number): number[] {
    const { start, end } = resolveGenerationWindow(window, durationMinutes, now)
    const slots: number[] = []

    for (let at = start; at <= end; at += SLOT_BOUNDARY_MS) {
        slots.push(at)
    }

    return slots
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

export interface AnnotatedSlot {
    startsAt: number
    availability: SlotAvailability
}

export function annotatedCandidateSlots(
    window: ResolvedWindow,
    durationMinutes: number,
    now: number,
    bookedByTeamA: BookedWindow[],
    bookedByTeamB: BookedWindow[],
): AnnotatedSlot[] {
    return generateCandidateSlots(window, durationMinutes, now).map(startsAt => ({
        startsAt,
        availability: slotAvailability(startsAt, window, durationMinutes, now, bookedByTeamA, bookedByTeamB),
    }))
}
