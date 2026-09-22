import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { Modal } from '@/app/components/ui/modal'
import { ErrorBanner, teamInputClass } from '@/app/components/pages/teams/teamsShared'
import { formatSlotTime, useDisplayTimezone } from '@/app/utils/timezone'
import {
    ApiError, eventErrorMessage, fetchMatchSchedule, proposeMatchSlots, withdrawMatchProposal, acceptMatchProposal,
    type AcceptMatchProposalInput, type EventBracket, type ProposeMatchSlotsInput, type ScheduleEntryDetail,
} from '@/app/utils/api'
import { useNow } from '../predictions/predictionsShared'
import { teamLabel } from '../bracket/bracketShared'
import { proposerName, schedulabilityReason, whoseTurnLabel } from './scheduleShared'
import {
    MAX_PROPOSAL_SLOTS, annotatedCandidateSlots, effectiveMatchDurationMinutes, type SlotUnavailableReason,
} from './slotGeneration'

const REFRESH_MS = 30_000
const NOTE_MAX_LENGTH = 500

const SHORT_REASON_LABELS: Record<SlotUnavailableReason, string> = {
    outside_window: 'outside window',
    off_boundary: 'off boundary',
    inside_lead_time: 'too soon',
    conflicts_with_booking: 'booked',
}

const LONG_REASON_LABELS: Record<SlotUnavailableReason, string> = {
    outside_window: "Falls outside this match's scheduling window.",
    off_boundary: 'Not on a 15-minute mark.',
    inside_lead_time: 'Needs at least two hours notice.',
    conflicts_with_booking: 'Conflicts with a match one of the teams already has booked.',
}

interface SlotPickerModalProps {
    isOpen: boolean
    onClose: () => void
    slug: string
    matchId: string
    accessToken: string
    myTeamId: string | null
    canManage: boolean
    bracket: EventBracket | null
    onChanged?: () => void
}

export function SlotPickerModal({
    isOpen, onClose, slug, matchId, accessToken, myTeamId, canManage, bracket, onChanged,
}: SlotPickerModalProps) {
    const timezone = useDisplayTimezone()
    const now = useNow(60_000)

    const [detail, setDetail] = useState<ScheduleEntryDetail | null>(null)
    const [loaded, setLoaded] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [selected, setSelected] = useState<number[]>([])
    const [note, setNote] = useState('')
    const [managerTeamId, setManagerTeamId] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [withdrawing, setWithdrawing] = useState(false)
    const [acceptingIndex, setAcceptingIndex] = useState<number | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)
    const [deadSlots, setDeadSlots] = useState<Record<number, string>>({})

    const load = useCallback(async () => {
        try {
            const schedule = await fetchMatchSchedule(accessToken, slug, matchId)
            setDetail(schedule)
            setLoadError(null)
        } catch (e) {
            setLoadError(eventErrorMessage(e))
        } finally {
            setLoaded(true)
        }
    }, [accessToken, slug, matchId])

    useEffect(() => {
        if (!isOpen) return
        setDetail(null)
        setLoaded(false)
        setLoadError(null)
        setSelected([])
        setNote('')
        setManagerTeamId(null)
        setActionError(null)
        setDeadSlots({})
        void load()
        const timer = setInterval(() => void load(), REFRESH_MS)
        return () => clearInterval(timer)
    }, [isOpen, load])

    const actingTeamId = myTeamId ?? managerTeamId

    const stage = useMemo(
        () => bracket?.stages.find(row => row.id === detail?.match.stage_id) ?? null,
        [bracket, detail],
    )
    const durationMinutes = stage ? effectiveMatchDurationMinutes(stage) : null

    const annotated = useMemo(() => {
        if (!detail || durationMinutes == null) return []
        const bookedA = detail.match.team_a?.booked ?? []
        const bookedB = detail.match.team_b?.booked ?? []
        return annotatedCandidateSlots(detail.match.resolved_window, durationMinutes, now, bookedA, bookedB)
    }, [detail, durationMinutes, now])

    useEffect(() => {
        setDeadSlots({})
    }, [detail?.proposal?.id])

    if (!isOpen) return null

    const proposal = detail?.proposal ?? null
    const isOwnProposal = !!proposal && !!actingTeamId && proposal.team_id === actingTeamId
    const isOpponentProposal = !!proposal && !isOwnProposal
    const booked = [detail?.match.team_a, detail?.match.team_b].filter((team): team is NonNullable<typeof team> => !!team)

    const toggleSlot = (startsAt: number) => {
        setSelected(current => {
            if (current.includes(startsAt)) return current.filter(value => value !== startsAt)
            if (current.length >= MAX_PROPOSAL_SLOTS) return current
            return [...current, startsAt].sort((a, b) => a - b)
        })
    }

    const submitProposal = async () => {
        if (selected.length === 0) return
        setSubmitting(true)
        setActionError(null)
        try {
            const input: ProposeMatchSlotsInput = {
                slots: selected.map(startsAt => new Date(startsAt).toISOString()),
                note: note.trim() || undefined,
            }
            if (actingTeamId) input.team_id = actingTeamId
            const schedule = await proposeMatchSlots(accessToken, slug, matchId, input)
            setDetail(schedule)
            setSelected([])
            setNote('')
            onChanged?.()
        } catch (e) {
            setActionError(eventErrorMessage(e))
        } finally {
            setSubmitting(false)
        }
    }

    const withdraw = async () => {
        setWithdrawing(true)
        setActionError(null)
        try {
            const schedule = await withdrawMatchProposal(accessToken, slug, matchId)
            setDetail(schedule)
            onChanged?.()
        } catch (e) {
            setActionError(eventErrorMessage(e))
        } finally {
            setWithdrawing(false)
        }
    }

    const acceptSlot = async (slotIndex: number) => {
        setAcceptingIndex(slotIndex)
        setActionError(null)
        try {
            const input: AcceptMatchProposalInput = { slot_index: slotIndex }
            if (actingTeamId) input.team_id = actingTeamId
            const schedule = await acceptMatchProposal(accessToken, slug, matchId, input)
            setDetail(schedule)
            onChanged?.()
        } catch (e) {
            if (e instanceof ApiError && (e.reason === 'slot_no_longer_valid' || e.reason === 'slot_conflicts_with_booking')) {
                setDeadSlots(current => ({ ...current, [slotIndex]: e.message }))
            } else {
                setActionError(eventErrorMessage(e))
            }
        } finally {
            setAcceptingIndex(null)
        }
    }

    const title = detail ? `${teamLabel(detail.match.team_a)} vs ${teamLabel(detail.match.team_b)}` : 'Schedule match'
    const alreadyBooked = detail && detail.match.status !== 'pending'

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            offsetSidebar
            maxWidth="40rem"
            title={title}
            leftAction={detail?.match.round_label ? (
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground shrink-0">{detail.match.round_label}</span>
            ) : undefined}
        >
            {!loaded ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : loadError ? (
                <div className="flex flex-col items-center gap-3 p-6">
                    <ErrorBanner message={loadError} />
                    <Button variant="secondary" onClick={() => void load()}>Try again</Button>
                </div>
            ) : !detail ? null : (
                <div className="space-y-4">
                    {alreadyBooked ? (
                        <p className="text-sm text-muted-foreground">
                            {detail.match.scheduled_at
                                ? `This match is already booked for ${formatSlotTime(detail.match.scheduled_at, timezone)}.`
                                : 'This match is no longer waiting on a time.'}
                        </p>
                    ) : !detail.schedulable ? (
                        <p className="text-sm text-muted-foreground">{schedulabilityReason(detail.reason)}</p>
                    ) : (
                        <>
                            <p className="text-xs text-muted-foreground">{whoseTurnLabel(detail, myTeamId)}</p>

                            <ErrorBanner message={actionError} />

                            {!myTeamId && canManage && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="shrink-0">Acting as</span>
                                    <select
                                        value={managerTeamId ?? ''}
                                        onChange={event => setManagerTeamId(event.target.value || null)}
                                        style={{ colorScheme: 'dark' }}
                                        className={cn(teamInputClass, 'h-7 py-0 text-xs')}
                                    >
                                        <option value="">Select a team…</option>
                                        {detail.match.team_a && <option value={detail.match.team_a.id}>{teamLabel(detail.match.team_a)}</option>}
                                        {detail.match.team_b && <option value={detail.match.team_b.id}>{teamLabel(detail.match.team_b)}</option>}
                                    </select>
                                </div>
                            )}

                            {booked.some(team => team.booked.length > 0) && (
                                <div className="space-y-1 rounded-lg border border-white/10 bg-card/20 p-3 text-[11px] text-muted-foreground">
                                    {booked.filter(team => team.booked.length > 0).map(team => (
                                        <p key={team.id}>
                                            {teamLabel(team)} already has {team.booked.map(entry => formatSlotTime(entry.starts_at, timezone)).join(', ')} booked.
                                        </p>
                                    ))}
                                </div>
                            )}

                            {proposal && (
                                <div className={cn(
                                    'space-y-2 rounded-lg border p-3',
                                    isOpponentProposal ? 'border-accent-500/40 bg-accent-500/5' : 'border-white/10 bg-card/30',
                                )}>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                                            {isOpponentProposal ? `${proposerName(detail)}'s offer is live` : 'Your offer is live'}
                                        </h4>
                                        {(isOwnProposal || canManage) && (
                                            <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]"
                                                disabled={withdrawing} onClick={() => void withdraw()}>
                                                {withdrawing ? 'Withdrawing…' : 'Withdraw'}
                                            </Button>
                                        )}
                                    </div>
                                    {proposal.note && <p className="text-xs text-muted-foreground">“{proposal.note}”</p>}
                                    <div className="space-y-1.5">
                                        {proposal.slots.map((slot, index) => {
                                            const dead = deadSlots[index]
                                            const unusable = slot.expired || !!dead
                                            return (
                                                <div key={index} className={cn(
                                                    'flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs',
                                                    unusable ? 'border-white/5 bg-white/5 text-muted-foreground/60' : 'border-white/10 bg-card/40 text-foreground',
                                                )}>
                                                    <span className={cn('tabular-nums', unusable && 'line-through')}>
                                                        {formatSlotTime(slot.starts_at, timezone)}
                                                    </span>
                                                    {dead && <span className="text-red-300">{dead}</span>}
                                                    {!unusable && isOpponentProposal && (
                                                        <Button size="sm" className="ml-auto h-6 px-2 text-[11px]"
                                                            disabled={acceptingIndex !== null || (!myTeamId && !managerTeamId)}
                                                            onClick={() => void acceptSlot(index)}>
                                                            {acceptingIndex === index ? 'Booking…' : 'Accept'}
                                                        </Button>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2 rounded-lg border border-white/10 bg-card/20 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        {!proposal ? 'Propose times' : isOwnProposal ? 'Update your times' : 'Counter with your own times'}
                                    </h4>
                                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                                        {selected.length}/{MAX_PROPOSAL_SLOTS} selected
                                    </span>
                                </div>

                                {durationMinutes == null ? (
                                    <p className="text-xs text-muted-foreground">Match details are still loading — try again shortly.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                        {annotated.map(slot => {
                                            const isSelected = selected.includes(slot.startsAt)
                                            const atLimit = !isSelected && selected.length >= MAX_PROPOSAL_SLOTS
                                            const disabled = !slot.availability.available || atLimit
                                            return (
                                                <button
                                                    key={slot.startsAt}
                                                    type="button"
                                                    disabled={disabled}
                                                    onClick={() => toggleSlot(slot.startsAt)}
                                                    title={!slot.availability.available ? LONG_REASON_LABELS[slot.availability.reason] : undefined}
                                                    aria-label={!slot.availability.available
                                                        ? `${formatSlotTime(new Date(slot.startsAt).toISOString(), timezone)} — unavailable: ${LONG_REASON_LABELS[slot.availability.reason]}`
                                                        : undefined}
                                                    className={cn(
                                                        'flex flex-col items-center rounded-md border px-2.5 py-1.5 text-xs tabular-nums transition-colors',
                                                        slot.availability.available
                                                            ? isSelected
                                                                ? 'bg-accent-500/20 border-accent-500/60 text-accent-200 cursor-pointer'
                                                                : cn('bg-card/40 border-white/10 text-foreground cursor-pointer', !atLimit && 'hover:border-white/25')
                                                            : 'bg-white/[0.02] border-white/5 text-muted-foreground/50 line-through cursor-not-allowed',
                                                    )}
                                                >
                                                    <span>{formatSlotTime(new Date(slot.startsAt).toISOString(), timezone)}</span>
                                                    {!slot.availability.available && (
                                                        <span className="text-[9px] normal-case text-muted-foreground/60">
                                                            {SHORT_REASON_LABELS[slot.availability.reason]}
                                                        </span>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}

                                <textarea
                                    value={note}
                                    onChange={event => setNote(event.target.value)}
                                    maxLength={NOTE_MAX_LENGTH}
                                    placeholder="Optional note…"
                                    rows={2}
                                    className={cn(teamInputClass, 'w-full resize-none text-xs')}
                                />

                                <div className="flex justify-end">
                                    <Button
                                        size="sm"
                                        disabled={selected.length === 0 || submitting || (!myTeamId && !managerTeamId)}
                                        onClick={() => void submitProposal()}
                                    >
                                        {submitting ? 'Sending…' : !proposal ? 'Propose' : isOwnProposal ? 'Update proposal' : 'Counter'}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </Modal>
    )
}
