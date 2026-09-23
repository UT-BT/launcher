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
import { teamLabel, toLocalInput } from '../bracket/bracketShared'
import { proposerName, schedulabilityReason, whoseTurnLabel } from './scheduleShared'
import {
    MAX_PROPOSAL_SLOTS, SLOT_BOUNDARY_MINUTES, effectiveMatchDurationMinutes, pickerBounds, slotAvailability,
    type SlotUnavailableReason,
} from './slotGeneration'

const REFRESH_MS = 30_000
const NOTE_MAX_LENGTH = 500

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
    const [slotInputs, setSlotInputs] = useState<string[]>([''])
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
        setSlotInputs([''])
        setNote('')
        setManagerTeamId(null)
        setActionError(null)
        setDeadSlots({})
        void load()
        const timer = setInterval(() => void load(), REFRESH_MS)
        return () => clearInterval(timer)
    }, [isOpen, load])

    const actingTeamId = myTeamId ?? managerTeamId
    const proposal = detail?.proposal ?? null
    const isOwnProposal = !!proposal && !!actingTeamId && proposal.team_id === actingTeamId

    const stage = useMemo(
        () => bracket?.stages.find(row => row.id === detail?.match.stage_id) ?? null,
        [bracket, detail],
    )
    const durationMinutes = stage ? effectiveMatchDurationMinutes(stage) : null

    const bounds = useMemo(() => {
        if (!detail || durationMinutes == null) return null
        return pickerBounds(detail.slot_window, durationMinutes, now)
    }, [detail, durationMinutes, now])

    const minInput = bounds ? toLocalInput(new Date(bounds.minMs).toISOString()) : undefined
    const maxInput = bounds?.maxMs != null ? toLocalInput(new Date(bounds.maxMs).toISOString()) : undefined

    const rowAvailability = useMemo(() => {
        if (!detail || durationMinutes == null) return slotInputs.map(() => null)
        const bookedA = detail.match.team_a?.booked ?? []
        const bookedB = detail.match.team_b?.booked ?? []
        return slotInputs.map(value => {
            if (!value) return null
            const ms = new Date(value).getTime()
            if (Number.isNaN(ms)) return null
            return { ms, availability: slotAvailability(ms, detail.slot_window, durationMinutes, now, bookedA, bookedB) }
        })
    }, [slotInputs, detail, durationMinutes, now])

    const filledRows = rowAvailability.filter((row): row is NonNullable<typeof row> => row !== null)
    const allFilledValid = filledRows.every(row => row.availability.available)

    useEffect(() => {
        setDeadSlots({})
        const ownSlots = isOwnProposal ? (proposal?.slots.map(slot => toLocalInput(slot.starts_at)) ?? []) : []
        setSlotInputs(ownSlots.length > 0 ? ownSlots : [''])
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [detail?.proposal?.id, isOwnProposal])

    if (!isOpen) return null

    const isOpponentProposal = !!proposal && !isOwnProposal
    const booked = [detail?.match.team_a, detail?.match.team_b].filter((team): team is NonNullable<typeof team> => !!team)

    const setSlotAt = (index: number, value: string) => {
        setSlotInputs(current => current.map((entry, i) => (i === index ? value : entry)))
    }

    const addSlotRow = () => {
        setSlotInputs(current => (current.length >= MAX_PROPOSAL_SLOTS ? current : [...current, '']))
    }

    const removeSlotRow = (index: number) => {
        setSlotInputs(current => {
            const next = current.filter((_, i) => i !== index)
            return next.length > 0 ? next : ['']
        })
    }

    const submitProposal = async () => {
        if (filledRows.length === 0) return
        setSubmitting(true)
        setActionError(null)
        try {
            const input: ProposeMatchSlotsInput = {
                slots: filledRows.map(row => new Date(row.ms).toISOString()),
                note: note.trim() || undefined,
            }
            if (actingTeamId) input.team_id = actingTeamId
            const schedule = await proposeMatchSlots(accessToken, slug, matchId, input)
            setDetail(schedule)
            setSlotInputs([''])
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
                                        {filledRows.length}/{MAX_PROPOSAL_SLOTS} added
                                    </span>
                                </div>

                                {durationMinutes == null ? (
                                    <p className="text-xs text-muted-foreground">Match details are still loading — try again shortly.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {slotInputs.map((value, index) => {
                                            const row = rowAvailability[index]
                                            return (
                                                <div key={index} className="flex items-start gap-2">
                                                    <div className="flex-1 min-w-0 space-y-1">
                                                        <input
                                                            type="datetime-local"
                                                            step={SLOT_BOUNDARY_MINUTES * 60}
                                                            min={minInput}
                                                            max={maxInput}
                                                            value={value}
                                                            onChange={event => setSlotAt(index, event.target.value)}
                                                            style={{ colorScheme: 'dark' }}
                                                            className={cn(
                                                                teamInputClass, 'w-full h-8 py-1 text-xs',
                                                                row && !row.availability.available && 'border-red-500/50',
                                                            )}
                                                        />
                                                        {row && (
                                                            row.availability.available
                                                                ? (
                                                                    <p className="text-[11px] text-muted-foreground">
                                                                        Proposing {formatSlotTime(new Date(row.ms).toISOString(), timezone)}
                                                                    </p>
                                                                )
                                                                : <p className="text-[11px] text-red-300">{LONG_REASON_LABELS[row.availability.reason]}</p>
                                                        )}
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 px-2 text-[11px] shrink-0"
                                                        onClick={() => removeSlotRow(index)}
                                                    >
                                                        Remove
                                                    </Button>
                                                </div>
                                            )
                                        })}

                                        {slotInputs.length < MAX_PROPOSAL_SLOTS && (
                                            <Button size="sm" variant="secondary" className="text-[11px]" onClick={addSlotRow}>
                                                + Add another time
                                            </Button>
                                        )}
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
                                        disabled={filledRows.length === 0 || !allFilledValid || submitting || (!myTeamId && !managerTeamId)}
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
