import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DoorOpen, ExternalLink, Link as LinkIcon, Radio } from 'lucide-react'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell,
    DataTableEmpty, DataTableSkeletonRow, type ColumnTier, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { Button } from '@/app/components/ui/button'
import { NavLink } from '@/app/components/navigation/NavLink'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { formatSlotTime, useDisplayTimezone } from '@/app/utils/timezone'
import { createPoller } from '@/app/utils/poller'
import { useCopyFeedback } from '@/app/hooks/useCopyFeedback'
import {
    eventErrorMessage, fetchEventStreamers, fetchPickBanQueue, sendPickBanManagerCommand, setMatchStreamer,
    type EventStreamer, type PickBanQueueEntry,
} from '@/app/utils/api'
import { ErrorBanner } from '@/app/components/pages/teams/teamsShared'
import { PickBanStatusChip } from '@/app/components/pages/events/pickban/components/PickBanStatusChip'
import { streamerName } from '@/app/components/pages/events/eventsShared'
import { streamerListNote } from '@/app/components/pages/events/streamerRoster'
import { StaffPicker } from '../StaffPicker'
import { streamerChoices, toQueueRow, withQueueStreamer, type PickBanQueueRow } from './pickBanQueue'

const QUEUE_POLL_MS = 20_000
const SKELETON_ROWS = 4

type QueueColumnId = 'match' | 'stage' | 'scheduled' | 'streamer' | 'status' | 'presence' | 'actions'

const COLUMNS: (ResponsiveColumn & { id: QueueColumnId; tier: ColumnTier; label: string })[] = [
    { id: 'match', width: '14rem', priority: 70, required: true, tier: 'essential', label: 'Match' },
    { id: 'stage', width: '10rem', priority: 40, tier: 'detail', label: 'Stage / Round' },
    { id: 'scheduled', width: '9rem', priority: 50, tier: 'detail', label: 'Scheduled' },
    { id: 'streamer', width: '10rem', priority: 55, tier: 'detail', label: 'Streamer' },
    { id: 'status', width: '10rem', priority: 65, required: true, tier: 'essential', label: 'Status' },
    { id: 'presence', width: '8rem', priority: 30, tier: 'detail', label: 'Ready / Online' },
    { id: 'actions', width: '15rem', priority: 60, required: true, tier: 'essential', label: 'Actions' },
]

const CELL_ALIGN: Partial<Record<QueueColumnId, 'right'>> = { presence: 'right', actions: 'right' }

interface PickBanQueuePanelProps {
    accessToken: string
    slug: string
}

export function PickBanQueuePanel({ accessToken, slug }: PickBanQueuePanelProps) {
    const { navigate } = useNavigation()
    const timezone = useDisplayTimezone()
    const [entries, setEntries] = useState<PickBanQueueEntry[] | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [openingId, setOpeningId] = useState<string | null>(null)
    const [streamers, setStreamers] = useState<EventStreamer[] | null>(null)
    const [streamersFailed, setStreamersFailed] = useState(false)
    const [savingStreamerId, setSavingStreamerId] = useState<string | null>(null)
    const [streamerError, setStreamerError] = useState<string | null>(null)
    const { copiedKey, copy } = useCopyFeedback(e => setError(eventErrorMessage(e)))
    const [resolved, setResolved] = useState<Set<string> | null>(null)
    const handleResolve = useCallback((ids: Set<string>) => setResolved(ids), [])
    const isVisible = (id: string) => !resolved || resolved.has(id)
    const visibleCount = COLUMNS.filter(c => isVisible(c.id)).length

    const tokenRef = useRef(accessToken)
    tokenRef.current = accessToken

    const poller = useMemo(() => createPoller({
        intervalMs: () => QUEUE_POLL_MS,
        poll: async (signal) => {
            const next = await fetchPickBanQueue(tokenRef.current, slug, signal)
            setEntries(next)
            setError(null)
        },
        onSettled: (outcome) => {
            setLoading(false)
            if (!outcome.ok) setError(eventErrorMessage(outcome.error))
        },
    }), [slug])

    useEffect(() => {
        poller.start()
        return () => poller.stop()
    }, [poller])

    const loadStreamers = useCallback(async (signal?: AbortSignal) => {
        try {
            setStreamers(await fetchEventStreamers(tokenRef.current, slug, signal))
            setStreamersFailed(false)
        } catch {
            if (!signal?.aborted) setStreamersFailed(true)
        }
    }, [slug])

    useEffect(() => {
        const controller = new AbortController()
        void loadStreamers(controller.signal)
        return () => controller.abort()
    }, [loadStreamers])

    const rows = useMemo(() => (entries ?? []).map(entry => toQueueRow(entry, slug)), [entries, slug])

    const assignStreamer = async (matchId: string, userId: string | null) => {
        setSavingStreamerId(matchId)
        setStreamerError(null)
        try {
            const streamer = await setMatchStreamer(accessToken, slug, matchId, userId)
            setEntries(current => current && withQueueStreamer(current, matchId, streamer))
        } catch (e) {
            setStreamerError(eventErrorMessage(e))
        } finally {
            setSavingStreamerId(null)
        }
    }

    const streamerPicker = (row: PickBanQueueRow) => (
        <StaffPicker
            kind="Streamer"
            noneLabel="No streamer"
            current={row.streamer}
            choices={streamerChoices(streamers ?? [], row.streamer)}
            emptyNote={streamerListNote(streamersFailed, streamers === null)}
            saving={savingStreamerId === row.matchId}
            nameOf={streamerName}
            onOpen={() => { void loadStreamers() }}
            onChange={userId => { void assignStreamer(row.matchId, userId) }}
        />
    )

    const openLobby = async (matchId: string) => {
        setOpeningId(matchId)
        try {
            await sendPickBanManagerCommand(accessToken, slug, matchId, 'open')
            await poller.refresh()
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setOpeningId(null)
        }
    }

    const openPage = (matchId: string) => navigate('match-pickban', { eventSlug: slug, matchId })

    const scheduledLabel = (row: PickBanQueueRow) => (row.scheduledAt ? formatSlotTime(row.scheduledAt, timezone) : 'Unscheduled')

    const queueCell = (id: QueueColumnId, row: PickBanQueueRow): React.ReactNode => {
        switch (id) {
            case 'match':
                return (
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{row.teamAName} vs {row.teamBName}</div>
                        {row.blockingReasonLabel && <div className="text-xs text-amber-300 truncate">{row.blockingReasonLabel}</div>}
                    </div>
                )
            case 'stage':
                return (
                    <>
                        <span className="text-foreground truncate block">{row.stageName}</span>
                        <span className="text-xs text-muted-foreground truncate block">{row.roundLabel}</span>
                    </>
                )
            case 'scheduled':
                return <span className="text-xs text-muted-foreground">{scheduledLabel(row)}</span>
            case 'streamer':
                return streamerPicker(row)
            case 'status':
                return <PickBanStatusChip status={row.status} />
            case 'presence':
                return <span className="text-xs text-muted-foreground tabular-nums">{row.readyCount}/2 · {row.onlineCount} online</span>
            case 'actions':
                return (
                    <RowActions
                        row={row} eventSlug={slug} openingId={openingId} copiedKey={copiedKey}
                        onOpenLobby={openLobby} onOpenPage={() => openPage(row.matchId)} onCopy={copy}
                    />
                )
        }
    }

    const columns: ResponsiveColumn<PickBanQueueRow>[] = COLUMNS.map(column => ({
        ...column,
        cell: row => <div className="min-w-0 flex-1">{queueCell(column.id, row)}</div>,
    }))

    const queueFace = (row: PickBanQueueRow) => (
        <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
                {queueCell('match', row)}
                {queueCell('status', row)}
            </div>
            {queueCell('actions', row)}
        </div>
    )

    const cardPlaceholder = loading ? (
        Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <div key={i} className="h-16 mx-3 my-2 rounded-lg bg-hairline/5 animate-pulse" />
        ))
    ) : rows.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No matches in this event yet.
        </div>
    ) : undefined

    return (
        <section aria-label="Match queue" className="flex flex-col gap-3">
            <div>
                <h2 className="text-sm font-semibold text-foreground">Match queue</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Every match in the event, in scheduled-time order.</p>
            </div>

            <ErrorBanner message={error} />
            <ErrorBanner message={streamerError} />

            <DataTableShell
                className="!flex-none"
                responsive={{
                    columns,
                    onResolve: handleResolve,
                    compactAriaLabel: 'Match queue',
                    cards: {
                        rows,
                        rowKey: row => row.matchId,
                        face: queueFace,
                        onOpen: row => openPage(row.matchId),
                        placeholder: cardPlaceholder,
                    },
                }}
            >
                <DataTableHeaderRow>
                    <DataTableHeaderCell width="14rem">Match</DataTableHeaderCell>
                    {isVisible('stage') && <DataTableHeaderCell width="10rem">Stage / Round</DataTableHeaderCell>}
                    {isVisible('scheduled') && <DataTableHeaderCell width="9rem">Scheduled</DataTableHeaderCell>}
                    {isVisible('streamer') && <DataTableHeaderCell width="10rem">Streamer</DataTableHeaderCell>}
                    <DataTableHeaderCell width="10rem">Status</DataTableHeaderCell>
                    {isVisible('presence') && <DataTableHeaderCell align="right" width="8rem">Ready / Online</DataTableHeaderCell>}
                    <DataTableHeaderCell align="right" width="15rem">Actions</DataTableHeaderCell>
                </DataTableHeaderRow>
                <tbody>
                    {loading ? (
                        Array.from({ length: SKELETON_ROWS }).map((_, i) => <DataTableSkeletonRow key={i} columnCount={visibleCount} />)
                    ) : rows.length === 0 ? (
                        <DataTableEmpty colSpan={visibleCount} message="No matches in this event yet." />
                    ) : rows.map(row => (
                        <DataTableRow key={row.matchId}>
                            {COLUMNS.filter(column => isVisible(column.id)).map(column => (
                                <DataTableCell key={column.id} align={CELL_ALIGN[column.id]}>{queueCell(column.id, row)}</DataTableCell>
                            ))}
                        </DataTableRow>
                    ))}
                </tbody>
            </DataTableShell>
        </section>
    )
}

function RowActions({ row, eventSlug, openingId, copiedKey, onOpenLobby, onOpenPage, onCopy }: {
    row: PickBanQueueRow
    eventSlug: string
    openingId: string | null
    copiedKey: string | null
    onOpenLobby: (matchId: string) => void
    onOpenPage: () => void
    onCopy: (key: string, text: string) => void
}) {
    const playerKey = `${row.matchId}-player`
    const streamKey = `${row.matchId}-stream`

    return (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
            {row.canOpenLobby && (
                <Button size="sm" onClick={() => onOpenLobby(row.matchId)} disabled={openingId === row.matchId}>
                    <DoorOpen /> {openingId === row.matchId ? 'Opening…' : 'Open Lobby'}
                </Button>
            )}
            <Button asChild size="sm" variant="outline">
                <NavLink view="match-pickban" params={{ eventSlug, matchId: row.matchId }} onActivate={onOpenPage}>
                    <ExternalLink /> Open Page
                </NavLink>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onCopy(playerKey, row.playerLink)}>
                <LinkIcon /> {copiedKey === playerKey ? 'Copied' : 'Copy Player Link'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onCopy(streamKey, row.streamLink)}>
                <Radio /> {copiedKey === streamKey ? 'Copied' : 'Copy Stream Link'}
            </Button>
        </div>
    )
}
