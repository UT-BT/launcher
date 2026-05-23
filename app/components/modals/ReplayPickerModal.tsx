import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Modal } from '@/app/components/ui/modal'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import {
    fetchMapLeaderboard, fetchDemoStatus, getFirstPersonVideoUrl,
    LeaderboardEntry, MapMetadata,
} from '@/app/utils/api'
import { computeMedalTier, TIER_ICONS, TIER_LABELS, MedalTier } from '@/app/components/pages/MapsPage'

interface ReplayPickerModalProps {
    open: boolean
    onClose: () => void
    accessToken?: string
    userId?: string | number
    mapName: string | null
    mapMetadata?: MapMetadata
    onSelect: (url: string, mapName: string, entry: LeaderboardEntry) => void
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

const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    const msStr = ms.toString().padStart(3, '0')
    const secsStr = secs.toString().padStart(2, '0')
    const minsStr = minutes.toString().padStart(2, '0')
    if (hours > 0) return `${hours}:${minsStr}:${secsStr}.${msStr}`
    return `${minsStr}:${secsStr}.${msStr}`
}

export function ReplayPickerModal({
    open, onClose, accessToken, userId, mapName, mapMetadata, onSelect,
}: ReplayPickerModalProps) {
    const [loading, setLoading] = useState(false)
    const [rows, setRows] = useState<RunRow[]>([])
    const [error, setError] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const requestRef = useRef(0)
    const pageRef = useRef(1)
    pageRef.current = page

    useEffect(() => {
        if (!open || !mapName || !accessToken) {
            setRows([])
            setError(null)
            setPage(1)
            return
        }
        const myRequest = ++requestRef.current
        let cancelled = false
        setError(null)
        setPage(1)

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
                const leaderboard = await fetchMapLeaderboard(accessToken, mapName, true)
                if (cancelled || requestRef.current !== myRequest) return
                const eligible = leaderboard.filter(e => e.id)
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
    }, [open, mapName, accessToken])

    // --- Priority-queue worker: fetch demo statuses, current page first ---
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
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
    const clampedPage = Math.min(page, totalPages)
    const pageRows = useMemo(() => {
        const start = (clampedPage - 1) * PAGE_SIZE
        return rows.slice(start, start + PAGE_SIZE).map((r, i) => ({ row: r, rank: start + i + 1 }))
    }, [rows, clampedPage])

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={mapName ? `Replays — ${mapName.replace('CTF-BT-', '')}` : 'Replays'}
            offsetSidebar
            maxWidth="640px"
            className="bg-[#0a0a0b]/98 border-white/5"
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

                {!loading && rows.length === 0 && !error && (
                    <div className="text-center py-10 text-sm text-muted-foreground">
                        No runs found for this map.
                    </div>
                )}

                {!loading && rows.length > 0 && (
                    <>
                        <div className="space-y-1.5">
                            {pageRows.map(({ row, rank }) => {
                                const isOwn = userIdStr != null && String(row.entry.user) === userIdStr
                                const checking = row.videoUrl === undefined
                                const unavailable = row.videoUrl === null
                                const url = row.videoUrl
                                const clickable = typeof url === 'string'
                                const handleActivate = () => {
                                    if (clickable && mapName) onSelect(url as string, mapName, row.entry)
                                }
                                return (
                                    <div
                                        key={row.entry.id}
                                        role="button"
                                        tabIndex={clickable ? 0 : -1}
                                        aria-disabled={!clickable}
                                        onClick={handleActivate}
                                        onKeyDown={e => {
                                            if (!clickable) return
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                handleActivate()
                                            }
                                        }}
                                        className={
                                            clickable
                                                ? 'w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/15 transition-colors text-left cursor-pointer'
                                                : 'w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-white/5 bg-white/[0.02] opacity-60 cursor-default'
                                        }
                                    >
                                        <span className="text-xs font-bold font-mono w-6 text-muted-foreground shrink-0">
                                            #{rank}
                                        </span>
                                        <span className="flex-1 min-w-0 pointer-events-none">
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
                                                <img
                                                    src={TIER_ICONS[tier]}
                                                    alt={TIER_LABELS[tier]}
                                                    title={TIER_LABELS[tier]}
                                                    className="size-5 shrink-0 object-contain"
                                                />
                                            )
                                        })()}
                                        <span className="text-sm font-mono text-amber-300 shrink-0">
                                            {formatTime(row.entry.cap_time_seconds)}
                                        </span>
                                        {checking && (
                                            <Loader2 className="size-4 animate-spin text-muted-foreground/60 shrink-0" />
                                        )}
                                        {unavailable && (
                                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 shrink-0">
                                                No replay
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={clampedPage <= 1}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-white/10 bg-white/5 text-muted-foreground hover:text-white hover:bg-white/10 hover:border-white/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default disabled:hover:bg-white/5 disabled:hover:border-white/10 disabled:hover:text-muted-foreground"
                                >
                                    <ChevronLeft className="size-3.5" /> Prev
                                </button>
                                <span className="text-xs text-muted-foreground">
                                    Page {clampedPage} of {totalPages} · {rows.length} runs
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={clampedPage >= totalPages}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-white/10 bg-white/5 text-muted-foreground hover:text-white hover:bg-white/10 hover:border-white/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default disabled:hover:bg-white/5 disabled:hover:border-white/10 disabled:hover:text-muted-foreground"
                                >
                                    Next <ChevronRight className="size-3.5" />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </Modal>
    )
}
