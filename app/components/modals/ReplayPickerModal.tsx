import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, ChevronLeft, ChevronRight, Download, Play, Columns2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/app/components/ui/modal'
import { Tooltip } from '@/app/components/ui/tooltip'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { TeamHolders } from '@/app/components/shared/TeamHolders'
import { openTeamCap } from '@/app/components/shared/CapTimeLink'
import { DemoDownloadStatusModal } from '@/app/components/shared/DemoDownloadStatusModal'
import { useDemoDownload } from '@/app/hooks/useDemoDownload'
import {
    fetchMapLeaderboard, fetchTeamMapLeaderboard, fetchDemoStatus, getFirstPersonVideoUrl,
    LeaderboardEntry, TeamLeaderboardEntry, MapMetadata,
} from '@/app/utils/api'
import { computeMedalTier, TIER_ICONS, TIER_LABELS, MedalTier } from '@/app/components/pages/MapsPage'
import { formatCapTime, displayMapName } from '@/app/utils/format'

interface ReplayPickerModalProps {
    open: boolean
    onClose: () => void
    accessToken?: string
    userId?: string | number
    mapName: string | null
    mapMetadata?: MapMetadata
    onSelect: (url: string, mapName: string, entry: LeaderboardEntry) => void
    compareMode?: boolean
    excludeCapId?: string
}

type RunRow = {
    entry: LeaderboardEntry
    videoUrl: string | null | undefined  // undefined = not checked, null = no video, string = video URL
}

const PAGE_SIZE = 10
const CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry { rows: RunRow[]; fetchedAt: number }
const replayCache = new Map<string, CacheEntry>()

function readCache(mapName: string): RunRow[] | null {
    const c = replayCache.get(mapName)
    if (!c) return null
    if (Date.now() - c.fetchedAt > CACHE_TTL_MS) {
        replayCache.delete(mapName)
        return null
    }
    return c.rows
}

function writeCache(mapName: string, rows: RunRow[]): void {
    replayCache.set(mapName, { rows, fetchedAt: Date.now() })
}

export function ReplayPickerModal({
    open, onClose, accessToken, userId, mapName, mapMetadata, onSelect,
    compareMode = false, excludeCapId,
}: ReplayPickerModalProps) {
    const [loading, setLoading] = useState(false)
    const [rows, setRows] = useState<RunRow[]>([])
    const [teamRuns, setTeamRuns] = useState<TeamLeaderboardEntry[]>([])
    const [error, setError] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const requestRef = useRef(0)
    const pageRef = useRef(1)
    pageRef.current = page

    const isTeam = !compareMode && (mapMetadata?.required_players ?? 1) > 1

    const demoDownload = useDemoDownload()

    useEffect(() => {
        if (!open || !mapName) {
            setRows([])
            setTeamRuns([])
            setError(null)
            setPage(1)
            return
        }
        const myRequest = ++requestRef.current
        let cancelled = false
        setError(null)
        setPage(1)

        if (isTeam) {
            setRows([])
            setTeamRuns([])
            setLoading(true)
            ;(async () => {
                try {
                    const leaderboard = await fetchTeamMapLeaderboard(accessToken ?? '', mapName)
                    if (cancelled || requestRef.current !== myRequest) return
                    setTeamRuns(leaderboard.filter(e => e.id))
                    setLoading(false)
                } catch {
                    if (cancelled || requestRef.current !== myRequest) return
                    setError('Failed to load runs.')
                    setLoading(false)
                }
            })()
            return () => { cancelled = true }
        }

        setTeamRuns([])
        const cached = readCache(mapName)
        if (cached) {
            setRows(cached)
            setLoading(false)
            return () => { cancelled = true }
        }

        setRows([])
        setLoading(true)

        ;(async () => {
            try {
                const leaderboard = await fetchMapLeaderboard(accessToken ?? '', mapName, true)
                if (cancelled || requestRef.current !== myRequest) return
                const eligible = leaderboard.filter(e => e.id && e.id !== excludeCapId)
                const initial: RunRow[] = eligible.map(e => ({ entry: e, videoUrl: undefined }))
                setRows(initial)
                setLoading(false)
            } catch {
                if (cancelled || requestRef.current !== myRequest) return
                setError('Failed to load runs.')
                setLoading(false)
            }
        })()

        return () => {
            cancelled = true
        }
    }, [open, mapName, accessToken, excludeCapId, isTeam])

    // Fetch demo statuses with a small worker pool, prioritizing the visible
    // page so users don't wait for off-page rows before seeing playability.
    useEffect(() => {
        if (rows.length === 0) return
        const snapshotIds = rows.map(r => r.entry.id)
        const fetched = new Set<string>()
        for (const r of rows) {
            if (r.videoUrl !== undefined) fetched.add(r.entry.id)
        }
        let cancelled = false
        const CONCURRENCY = 3

        const pickNext = (): string | null => {
            const start = (pageRef.current - 1) * PAGE_SIZE
            const end = Math.min(start + PAGE_SIZE, snapshotIds.length)
            for (let i = start; i < end; i++) {
                const id = snapshotIds[i]
                if (!fetched.has(id)) return id
            }
            for (let i = 0; i < snapshotIds.length; i++) {
                const id = snapshotIds[i]
                if (!fetched.has(id)) return id
            }
            return null
        }

        const worker = async () => {
            while (!cancelled) {
                const id = pickNext()
                if (!id) return
                fetched.add(id)
                const status = await fetchDemoStatus(id)
                if (cancelled) return
                const url = getFirstPersonVideoUrl(status)
                setRows(prev => {
                    const next = prev.map(r => r.entry.id === id ? { ...r, videoUrl: url } : r)
                    if (mapName) writeCache(mapName, next)
                    return next
                })
            }
        }

        Promise.all(Array.from({ length: CONCURRENCY }, () => worker())).catch(() => { /* swallow */ })
        return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows.length, mapName])

    const userIdStr = userId != null ? String(userId) : null
    const listLength = isTeam ? teamRuns.length : rows.length
    const totalPages = Math.max(1, Math.ceil(listLength / PAGE_SIZE))
    const clampedPage = Math.min(page, totalPages)
    const pageRows = useMemo(() => {
        const start = (clampedPage - 1) * PAGE_SIZE
        return rows.slice(start, start + PAGE_SIZE).map((r, i) => ({ row: r, rank: start + i + 1 }))
    }, [rows, clampedPage])
    const teamPageRows = useMemo(() => {
        const start = (clampedPage - 1) * PAGE_SIZE
        return teamRuns.slice(start, start + PAGE_SIZE).map((entry, i) => ({ entry, rank: start + i + 1 }))
    }, [teamRuns, clampedPage])

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={compareMode
                ? (mapName ? `Compare run — ${displayMapName(mapName)}` : 'Compare run')
                : (mapName ? `Replays — ${displayMapName(mapName)}` : 'Replays')}
            offsetSidebar
            maxWidth="640px"
            className="bg-card/98 border-hairline/5"
            footer={null}
        >
            <div className="space-y-3">
                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {loading && (
                    <div className="flex items-center justify-center py-10 text-muted-foreground">
                        <Loader2 className="size-5 animate-spin mr-2" /> Loading leaderboard…
                    </div>
                )}

                {!loading && listLength === 0 && !error && (
                    <div className="text-center py-10 text-sm text-muted-foreground">
                        No runs found for this map.
                    </div>
                )}

                {!loading && listLength > 0 && (
                    <>
                        <div className="space-y-1.5">
                            {isTeam ? (
                                teamPageRows.map(({ entry, rank }) => (
                                    <div
                                        key={entry.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => { openTeamCap(entry.id); onClose() }}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTeamCap(entry.id); onClose() } }}
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-hairline/5 bg-hairline/[0.02] cursor-pointer hover:bg-hairline/[0.06] hover:border-hairline/15 transition-colors"
                                    >
                                        <span className="text-xs font-bold font-mono w-6 text-muted-foreground shrink-0">#{rank}</span>
                                        <span className="flex-1 min-w-0">
                                            <TeamHolders
                                                members={entry.members.map(m => ({ userId: m.user, alias: m.alias, activeTitle: m.active_title ?? null }))}
                                                size="sm"
                                                currentUserId={userIdStr}
                                            />
                                        </span>
                                        <span className="text-sm font-mono text-amber-300 shrink-0">
                                            {formatCapTime(entry.cap_time_seconds)}
                                        </span>
                                        <ChevronRight className="size-4 text-accent-300/80 shrink-0" />
                                    </div>
                                ))
                            ) : (
                                pageRows.map(({ row, rank }) => {
                                const isOwn = userIdStr != null && String(row.entry.user) === userIdStr
                                const checking = row.videoUrl === undefined
                                const unavailable = row.videoUrl === null
                                const url = row.videoUrl
                                const playable = typeof url === 'string'
                                if (compareMode) {
                                    const onPick = () => { if (playable && mapName) onSelect(url as string, mapName, row.entry) }
                                    return (
                                        <div
                                            key={row.entry.id}
                                            role="button"
                                            tabIndex={playable ? 0 : -1}
                                            aria-disabled={!playable}
                                            onClick={onPick}
                                            onKeyDown={(e) => { if (playable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPick() } }}
                                            className={cn(
                                                'w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-hairline/5 bg-hairline/[0.02] transition-colors',
                                                playable ? 'cursor-pointer hover:bg-hairline/[0.06] hover:border-hairline/15' : 'opacity-60 cursor-default',
                                            )}
                                        >
                                            <span className="text-xs font-bold font-mono w-6 text-muted-foreground shrink-0">#{rank}</span>
                                            <span className="flex-1 min-w-0">
                                                <PlayerInfo userId={row.entry.user} alias={row.entry.alias} title={row.entry.active_title} size="sm" highlight={isOwn} showYouBadge={isOwn} interactive={false} />
                                            </span>
                                            <span className="text-sm font-mono text-amber-300 shrink-0">{formatCapTime(row.entry.cap_time_seconds)}</span>
                                            {checking ? (
                                                <Loader2 className="size-4 animate-spin text-muted-foreground/60 shrink-0" />
                                            ) : unavailable ? (
                                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 shrink-0">No replay</span>
                                            ) : (
                                                <Columns2 className="size-4 text-accent-300/80 shrink-0" />
                                            )}
                                        </div>
                                    )
                                }
                                return (
                                    <div
                                        key={row.entry.id}
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-hairline/5 bg-hairline/[0.02] hover:bg-hairline/[0.04] transition-colors"
                                    >
                                        <span className="text-xs font-bold font-mono w-6 text-muted-foreground shrink-0">
                                            #{rank}
                                        </span>
                                        <span className="flex-1 min-w-0">
                                            <PlayerInfo
                                                userId={row.entry.user}
                                                alias={row.entry.alias}
                                                title={row.entry.active_title}
                                                size="sm"
                                                highlight={isOwn}
                                                showYouBadge={isOwn}
                                            />
                                        </span>
                                        {(() => {
                                            const tier: MedalTier = computeMedalTier(
                                                {
                                                    map: row.entry.map,
                                                    cap_time_seconds: row.entry.cap_time_seconds,
                                                    cap_type: row.entry.cap_type,
                                                    verified: row.entry.verified,
                                                },
                                                mapMetadata,
                                            )
                                            if (tier === 'uncapped') return null
                                            return (
                                                <Tooltip content={TIER_LABELS[tier]} side="top">
                                                    <img
                                                        src={TIER_ICONS[tier]}
                                                        alt={TIER_LABELS[tier]}
                                                        className="size-5 shrink-0 object-contain"
                                                    />
                                                </Tooltip>
                                            )
                                        })()}
                                        <span className="text-sm font-mono text-amber-300 shrink-0">
                                            {formatCapTime(row.entry.cap_time_seconds)}
                                        </span>
                                        {checking ? (
                                            <Loader2 className="size-4 animate-spin text-muted-foreground/60 shrink-0" />
                                        ) : unavailable ? (
                                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 shrink-0">
                                                No replay
                                            </span>
                                        ) : (
                                            <Tooltip content={compareMode ? 'Compare side by side' : 'Watch'} side="top">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (playable && mapName) onSelect(url as string, mapName, row.entry)
                                                    }}
                                                    disabled={!playable}
                                                    aria-label={compareMode ? 'Compare side by side' : 'Watch Replay'}
                                                    className={cn(
                                                        'p-1.5 rounded-md transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-default',
                                                        compareMode
                                                            ? 'text-accent-300/80 hover:text-accent-200 hover:bg-accent-500/15'
                                                            : 'text-rose-300/80 hover:text-rose-200 hover:bg-rose-500/15',
                                                    )}
                                                >
                                                    {compareMode ? <Columns2 className="size-4" /> : <Play className="size-4" />}
                                                </button>
                                            </Tooltip>
                                        )}
                                        <Tooltip content="Download Demo" side="top">
                                            <button
                                                type="button"
                                                onClick={() => mapName && demoDownload.start(row.entry, mapName)}
                                                aria-label="Download demo"
                                                className="p-1.5 rounded-md text-accent-300/80 hover:text-accent-200 hover:bg-accent-500/15 transition-colors cursor-pointer shrink-0"
                                            >
                                                <Download className="size-4" />
                                            </button>
                                        </Tooltip>
                                    </div>
                                )
                                })
                            )}
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-2 border-t border-hairline/5">
                                <button
                                    type="button"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={clampedPage <= 1}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-hairline/10 bg-hairline/5 text-muted-foreground hover:text-foreground hover:bg-hairline/10 hover:border-hairline/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default disabled:hover:bg-hairline/5 disabled:hover:border-hairline/10 disabled:hover:text-muted-foreground"
                                >
                                    <ChevronLeft className="size-3.5" /> Prev
                                </button>
                                <span className="text-xs text-muted-foreground">
                                    Page {clampedPage} of {totalPages} · {listLength} runs
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={clampedPage >= totalPages}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-hairline/10 bg-hairline/5 text-muted-foreground hover:text-foreground hover:bg-hairline/10 hover:border-hairline/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default disabled:hover:bg-hairline/5 disabled:hover:border-hairline/10 disabled:hover:text-muted-foreground"
                                >
                                    Next <ChevronRight className="size-3.5" />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <DemoDownloadStatusModal
                state={demoDownload.download}
                onClose={demoDownload.clear}
            />
        </Modal>
    )
}
