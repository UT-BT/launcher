import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, DoorOpen, ExternalLink, Link as LinkIcon, Radio } from 'lucide-react'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell,
    DataTableEmpty, DataTableSkeletonRow, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { Button } from '@/app/components/ui/button'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
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
import { streamerChoices, toQueueRow, withQueueStreamer, type PickBanQueueRow } from './pickBanQueue'

const QUEUE_POLL_MS = 20_000
const SKELETON_ROWS = 4
const NO_STREAMER = 'none'

const COLUMNS: ResponsiveColumn[] = [
    { id: 'match', width: '14rem', priority: 70, required: true },
    { id: 'stage', width: '10rem', priority: 40 },
    { id: 'scheduled', width: '9rem', priority: 50 },
    { id: 'streamer', width: '10rem', priority: 55 },
    { id: 'status', width: '10rem', priority: 65, required: true },
    { id: 'presence', width: '8rem', priority: 30 },
    { id: 'actions', width: '15rem', priority: 60, required: true },
]

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
        <StreamerPicker
            current={row.streamer}
            streamers={streamers}
            failed={streamersFailed}
            saving={savingStreamerId === row.matchId}
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

    const compactRows = loading ? (
        Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <div key={i} role="listitem" className="p-3 border-b border-hairline/5 last:border-0 animate-pulse">
                <div className="h-16 rounded bg-hairline/5" />
            </div>
        ))
    ) : rows.length === 0 ? (
        <div role="listitem" className="px-4 py-12 text-center text-sm text-muted-foreground">
            No matches in this event yet.
        </div>
    ) : rows.map(row => (
        <div key={row.matchId} role="listitem" className="p-3 border-b border-hairline/5 last:border-0 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-foreground truncate">{row.teamAName} vs {row.teamBName}</span>
                <PickBanStatusChip status={row.status} />
            </div>
            <div className="text-xs text-muted-foreground">{row.stageName} · {row.roundLabel} · {scheduledLabel(row)}</div>
            <div className="text-xs text-muted-foreground">Ready {row.readyCount}/2 · {row.onlineCount} online</div>
            {row.blockingReasonLabel && <div className="text-xs text-amber-300">{row.blockingReasonLabel}</div>}
            <div className="flex items-center gap-2 min-w-0 text-xs text-muted-foreground">
                Streamer
                {streamerPicker(row)}
            </div>
            <RowActions
                row={row} eventSlug={slug} openingId={openingId} copiedKey={copiedKey}
                onOpenLobby={openLobby} onOpenPage={() => openPage(row.matchId)} onCopy={copy}
            />
        </div>
    ))

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
                    columns: COLUMNS,
                    onResolve: handleResolve,
                    compactContent: compactRows,
                    compactAriaLabel: 'Match queue',
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
                            <DataTableCell>
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-foreground truncate">{row.teamAName} vs {row.teamBName}</div>
                                    {row.blockingReasonLabel && <div className="text-xs text-amber-300 truncate">{row.blockingReasonLabel}</div>}
                                </div>
                            </DataTableCell>
                            {isVisible('stage') && (
                                <DataTableCell>
                                    <span className="text-foreground truncate block">{row.stageName}</span>
                                    <span className="text-xs text-muted-foreground truncate block">{row.roundLabel}</span>
                                </DataTableCell>
                            )}
                            {isVisible('scheduled') && (
                                <DataTableCell>
                                    <span className="text-xs text-muted-foreground">{scheduledLabel(row)}</span>
                                </DataTableCell>
                            )}
                            {isVisible('streamer') && <DataTableCell>{streamerPicker(row)}</DataTableCell>}
                            <DataTableCell><PickBanStatusChip status={row.status} /></DataTableCell>
                            {isVisible('presence') && (
                                <DataTableCell align="right">
                                    <span className="text-xs text-muted-foreground tabular-nums">{row.readyCount}/2 · {row.onlineCount} online</span>
                                </DataTableCell>
                            )}
                            <DataTableCell align="right">
                                <RowActions
                                    row={row} eventSlug={slug} openingId={openingId} copiedKey={copiedKey}
                                    onOpenLobby={openLobby} onOpenPage={() => openPage(row.matchId)} onCopy={copy}
                                />
                            </DataTableCell>
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
                    <DoorOpen /> {openingId === row.matchId ? 'Opening…' : 'Open lobby'}
                </Button>
            )}
            <Button asChild size="sm" variant="outline">
                <NavLink view="match-pickban" params={{ eventSlug, matchId: row.matchId }} onActivate={onOpenPage}>
                    <ExternalLink /> Open page
                </NavLink>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onCopy(playerKey, row.playerLink)}>
                <LinkIcon /> {copiedKey === playerKey ? 'Copied' : 'Copy player link'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onCopy(streamKey, row.streamLink)}>
                <Radio /> {copiedKey === streamKey ? 'Copied' : 'Copy stream link'}
            </Button>
        </div>
    )
}

function StreamerPicker({ current, streamers, failed, saving, onOpen, onChange }: {
    current: EventStreamer | null
    streamers: EventStreamer[] | null
    failed: boolean
    saving: boolean
    onOpen: () => void
    onChange: (userId: string | null) => void
}) {
    const choices = streamerChoices(streamers ?? [], current)
    const selected = current?.id ?? NO_STREAMER

    return (
        <DropdownMenu onOpenChange={open => { if (open) onOpen() }}>
            <DropdownMenuTrigger asChild disabled={saving}>
                <button
                    type="button"
                    aria-label={current ? `Streamer: ${current.display_name}` : 'Streamer: none'}
                    className="inline-flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-hairline/10 bg-card/50 px-2 text-xs text-foreground hover:border-hairline/20 transition-colors cursor-pointer disabled:cursor-default disabled:opacity-60"
                >
                    {saving ? (
                        <span className="text-muted-foreground">Saving…</span>
                    ) : current ? (
                        <PlayerInfo userId={current.id} alias={current.display_name} size="sm" interactive={false} />
                    ) : (
                        <span className="text-muted-foreground">No streamer</span>
                    )}
                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
                <DropdownMenuRadioGroup
                    value={selected}
                    onValueChange={value => { if (value !== selected) onChange(value === NO_STREAMER ? null : value) }}
                >
                    <DropdownMenuRadioItem value={NO_STREAMER}>No streamer</DropdownMenuRadioItem>
                    {choices.length > 0 && <DropdownMenuSeparator />}
                    {choices.map(streamer => (
                        <DropdownMenuRadioItem key={streamer.id} value={streamer.id}>
                            <PlayerInfo userId={streamer.id} alias={streamer.display_name} size="sm" interactive={false} />
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
                {choices.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                        {failed
                            ? 'The streaming volunteers could not be loaded.'
                            : streamers === null ? 'Loading streamers…' : 'No volunteers have offered to stream yet.'}
                    </p>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
