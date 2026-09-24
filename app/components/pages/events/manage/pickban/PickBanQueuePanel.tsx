import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DoorOpen, ExternalLink, Link as LinkIcon, Radio } from 'lucide-react'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell,
    DataTableEmpty, DataTableSkeletonRow, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { Button } from '@/app/components/ui/button'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { formatSlotTime, useDisplayTimezone } from '@/app/utils/timezone'
import { cn } from '@/lib/utils'
import { createPoller } from '@/app/utils/poller'
import { eventErrorMessage, fetchPickBanQueue, sendPickBanManagerCommand, type PickBanQueueEntry } from '@/app/utils/api'
import { ErrorBanner } from '@/app/components/pages/teams/teamsShared'
import { toQueueRow, type PickBanQueueRow, type PickBanQueueStatusTone } from './pickBanQueue'

const QUEUE_POLL_MS = 20_000
const SKELETON_ROWS = 4

const STATUS_CHIP_CLASS: Record<PickBanQueueStatusTone, string> = {
    idle: 'bg-white/5 text-muted-foreground border-white/10',
    ready: 'bg-accent-500/15 text-accent-300 border-accent-500/30',
    live: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    paused: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    done: 'bg-emerald-500/10 text-emerald-300/80 border-emerald-500/20',
}

const COLUMNS: ResponsiveColumn[] = [
    { id: 'match', width: '14rem', priority: 70, required: true },
    { id: 'stage', width: '10rem', priority: 40 },
    { id: 'scheduled', width: '9rem', priority: 50 },
    { id: 'status', width: '10rem', priority: 65, required: true },
    { id: 'presence', width: '8rem', priority: 30 },
    { id: 'actions', width: '15rem', priority: 60, required: true },
]

interface PickBanQueuePanelProps {
    accessToken: string
    slug: string
}

function statusChip(row: PickBanQueueRow) {
    return (
        <span className={cn('inline-flex text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border', STATUS_CHIP_CLASS[row.statusTone])}>
            {row.statusLabel}
        </span>
    )
}

export function PickBanQueuePanel({ accessToken, slug }: PickBanQueuePanelProps) {
    const { navigate } = useNavigation()
    const timezone = useDisplayTimezone()
    const [entries, setEntries] = useState<PickBanQueueEntry[] | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [openingId, setOpeningId] = useState<string | null>(null)
    const [copiedKey, setCopiedKey] = useState<string | null>(null)
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

    const rows = useMemo(() => (entries ?? []).map(entry => toQueueRow(entry, slug)), [entries, slug])

    const openLobby = async (matchId: string) => {
        setOpeningId(matchId)
        try {
            await sendPickBanManagerCommand(accessToken, slug, matchId, 'open')
            await poller.pollNow()
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setOpeningId(null)
        }
    }

    const copyLink = async (key: string, text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedKey(key)
            window.setTimeout(() => setCopiedKey(current => (current === key ? null : current)), 1500)
        } catch (e) {
            setError(eventErrorMessage(e))
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
                {statusChip(row)}
            </div>
            <div className="text-xs text-muted-foreground">{row.stageName} · {row.roundLabel} · {scheduledLabel(row)}</div>
            <div className="text-xs text-muted-foreground">Ready {row.readyCount}/2 · {row.onlineCount} online</div>
            {row.blockingReasonLabel && <div className="text-xs text-amber-300">{row.blockingReasonLabel}</div>}
            <RowActions
                row={row} openingId={openingId} copiedKey={copiedKey}
                onOpenLobby={openLobby} onOpenPage={() => openPage(row.matchId)} onCopy={copyLink}
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
                            <DataTableCell>{statusChip(row)}</DataTableCell>
                            {isVisible('presence') && (
                                <DataTableCell align="right">
                                    <span className="text-xs text-muted-foreground tabular-nums">{row.readyCount}/2 · {row.onlineCount} online</span>
                                </DataTableCell>
                            )}
                            <DataTableCell align="right">
                                <RowActions
                                    row={row} openingId={openingId} copiedKey={copiedKey}
                                    onOpenLobby={openLobby} onOpenPage={() => openPage(row.matchId)} onCopy={copyLink}
                                />
                            </DataTableCell>
                        </DataTableRow>
                    ))}
                </tbody>
            </DataTableShell>
        </section>
    )
}

function RowActions({ row, openingId, copiedKey, onOpenLobby, onOpenPage, onCopy }: {
    row: PickBanQueueRow
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
            <Button size="sm" variant="outline" onClick={onOpenPage}>
                <ExternalLink /> Open page
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
