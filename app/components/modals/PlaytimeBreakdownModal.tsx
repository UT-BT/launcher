import { useMemo } from 'react'
import { Clock } from 'lucide-react'
import { Modal } from '@/app/components/ui/modal'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { cn } from '@/lib/utils'
import { displayMapName } from '@/app/utils/format'
import type { ActiveTitle, Playtime } from '@/app/utils/api'

interface PlaytimeBreakdownModalProps {
    open: boolean
    onClose: () => void
    mapName: string
    playtime: Playtime[]
    currentUserId?: string | number
}

interface PlayerRow {
    userId: number
    alias?: string
    activeTitle?: ActiveTitle | null
    totalSeconds: number
    sessions: number
}

function formatPlaytime(seconds: number): string {
    const hours = seconds / 3600
    if (hours >= 100) return `${Math.round(hours)} h`
    if (hours >= 1) return `${hours.toFixed(1)} h`
    const minutes = Math.round(seconds / 60)
    return `${minutes} m`
}

export function PlaytimeBreakdownModal({
    open, onClose, mapName, playtime, currentUserId,
}: PlaytimeBreakdownModalProps) {
    const { rows, total } = useMemo(() => {
        const byUser = new Map<number, PlayerRow>()
        let total = 0
        for (const p of playtime) {
            if (p.is_spectator) continue
            const secs = p.time_played_seconds || 0
            total += secs
            const existing = byUser.get(p.user)
            if (existing) {
                existing.totalSeconds += secs
                existing.sessions += 1
                if (!existing.alias && p.alias) existing.alias = p.alias
                if (!existing.activeTitle && p.active_title) existing.activeTitle = p.active_title
            } else {
                byUser.set(p.user, {
                    userId: p.user,
                    alias: p.alias,
                    activeTitle: p.active_title ?? null,
                    totalSeconds: secs,
                    sessions: 1,
                })
            }
        }
        const rows = Array.from(byUser.values()).sort((a, b) => b.totalSeconds - a.totalSeconds)
        return { rows, total }
    }, [playtime])

    const currentUserIdStr = currentUserId != null ? String(currentUserId) : null
    const maxSeconds = rows.length > 0 ? rows[0].totalSeconds : 0

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={`Playtime — ${displayMapName(mapName)}`}
            offsetSidebar
            maxWidth="720px"
            className="bg-[#0a0a0b]/98 border-white/5 backdrop-blur-3xl mx-auto"
            footer={null}
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 px-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="size-3.5 text-amber-300" />
                        <span>
                            <span className="text-white font-semibold tabular-nums">{rows.length}</span> player{rows.length === 1 ? '' : 's'} · total{' '}
                            <span className="text-amber-300 font-semibold tabular-nums">{formatPlaytime(total)}</span>
                        </span>
                    </div>
                </div>

                {rows.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                        No playtime recorded yet.
                    </div>
                ) : (
                    <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
                        {rows.map((r, i) => {
                            const isOwn = currentUserIdStr != null && String(r.userId) === currentUserIdStr
                            const pct = total > 0 ? (r.totalSeconds / total) * 100 : 0
                            const widthPct = maxSeconds > 0 ? (r.totalSeconds / maxSeconds) * 100 : 0
                            return (
                                <div
                                    key={r.userId}
                                    className={cn(
                                        'relative rounded-lg border px-3 py-2 transition-colors',
                                        isOwn
                                            ? 'bg-emerald-500/[0.07] border-emerald-500/30'
                                            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10',
                                    )}
                                >
                                    <div
                                        className="absolute inset-y-0 left-0 rounded-lg bg-amber-500/[0.06] pointer-events-none"
                                        style={{ width: `${widthPct}%` }}
                                    />
                                    <div className="relative flex items-center gap-3">
                                        <span className={cn(
                                            'inline-flex items-center justify-center min-w-7 h-6 px-2 rounded font-mono tabular-nums text-xs font-bold shrink-0',
                                            i === 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                                                i === 1 ? 'bg-slate-300/15 text-slate-200 border border-slate-300/30' :
                                                    i === 2 ? 'bg-amber-600/15 text-amber-400 border border-amber-600/30' :
                                                        'bg-white/5 text-muted-foreground border border-white/5',
                                        )}>
                                            {i + 1}
                                        </span>
                                        <PlayerInfo
                                            userId={r.userId}
                                            alias={r.alias}
                                            title={r.activeTitle}
                                            size="sm"
                                            highlight={isOwn}
                                            showYouBadge={isOwn}
                                            className="min-w-0 flex-1"
                                        />
                                        <div className="flex items-baseline gap-2 shrink-0 tabular-nums">
                                            <span className="text-xs text-muted-foreground">
                                                {r.sessions} session{r.sessions === 1 ? '' : 's'}
                                            </span>
                                            <span className="text-xs text-muted-foreground/70">
                                                {pct.toFixed(1)}%
                                            </span>
                                            <span className={cn(
                                                'text-sm font-mono font-bold min-w-14 text-right',
                                                isOwn ? 'text-emerald-300' : 'text-amber-300',
                                            )}>
                                                {formatPlaytime(r.totalSeconds)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </Modal>
    )
}
