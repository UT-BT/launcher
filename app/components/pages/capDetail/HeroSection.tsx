import type { ReactNode } from 'react'
import { Play, Download, Loader2, ShieldCheck, BadgeCheck, Users, Calendar, Columns2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { Tooltip } from '@/app/components/ui/tooltip'
import { displayMapName, formatCapTime, formatAddedDate } from '@/app/utils/format'
import { medalIconForInt, medalLabelForInt, formatSignedDelta, deltaClass } from './capStats'
import type { CapRecord } from '@/app/utils/api'

interface HeroSectionProps {
    cap: CapRecord
    mapName: string
    rank: number
    total: number
    deltaWr: number | null
    gapToNext: number | null
    isWr: boolean
    onMapSelect?: (mapName: string) => void
    onWatch: () => void
    watching: boolean
    canWatch: boolean
    onDownload: () => void
    onCompareRun: () => void
    canCompareRun: boolean
}

function ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

function friendlyDate(iso: string | null | undefined): string {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    const month = d.toLocaleDateString('en-US', { month: 'long' })
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
    return `${month} ${ordinal(d.getDate())}, ${d.getFullYear()} at ${time}`
}

function CapTypeBadge({ capType }: { capType: number | null | undefined }) {
    if (capType === 2) {
        return (
            <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md border text-xs font-semibold bg-blue-500/15 border-blue-500/40 text-blue-300">
                <BadgeCheck className="size-3.5" />
                Certified
            </span>
        )
    }
    if (capType === 3) {
        return (
            <span className="inline-flex items-center h-7 px-2 rounded-md border text-xs font-semibold bg-purple-500/15 border-purple-500/40 text-purple-300">
                i4Games
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md border text-xs font-semibold bg-hairline/5 border-hairline/10 text-muted-foreground">
            <Users className="size-3.5" />
            Casual
        </span>
    )
}

function MiniStat({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col justify-between h-full text-left">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="text-lg font-bold font-mono tabular-nums leading-none">{children}</div>
        </div>
    )
}

export function HeroSection({
    cap, mapName, rank, total, deltaWr, gapToNext, isWr,
    onMapSelect, onWatch, watching, canWatch, onDownload, onCompareRun, canCompareRun,
}: HeroSectionProps) {
    const medalIcon = medalIconForInt(cap.medal)
    const medalLabel = medalLabelForInt(cap.medal)
    const showMedal = cap.medal != null && cap.medal >= 1

    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl overflow-hidden shrink-0">
            <div className="flex flex-col lg:flex-row items-stretch">
                <div className="lg:w-64 lg:h-64 shrink-0 p-2">
                    <button
                        type="button"
                        onClick={() => onMapSelect?.(mapName)}
                        className="block w-full h-full cursor-pointer"
                        title={`Open ${displayMapName(mapName)}`}
                    >
                        <MapThumbnail
                            mapName={mapName}
                            className="w-full h-full aspect-video lg:aspect-square rounded-lg border border-hairline/10"
                        />
                    </button>
                </div>

                <div className="flex-1 p-4 flex flex-col justify-center gap-4 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => onMapSelect?.(mapName)}
                            className="text-3xl font-bold text-foreground leading-tight truncate hover:underline decoration-dotted underline-offset-4 cursor-pointer text-left min-w-0"
                        >
                            {displayMapName(mapName)}
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={onWatch}
                                disabled={!canWatch || watching}
                                className={cn(
                                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-colors text-xs font-semibold cursor-pointer',
                                    'bg-accent-500/15 border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:text-foreground hover:border-accent-500/60',
                                    'disabled:opacity-50 disabled:cursor-not-allowed',
                                )}
                                title={canWatch ? 'Watch replay' : 'No replay — cap not verified'}
                            >
                                {watching ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                                Watch replay
                            </button>
                            <button
                                type="button"
                                onClick={onCompareRun}
                                disabled={!canCompareRun}
                                className={cn(
                                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-colors text-xs font-semibold cursor-pointer',
                                    'bg-rose-500/15 border-rose-500/40 text-rose-200 hover:bg-rose-500/25 hover:text-foreground hover:border-rose-500/60',
                                    'disabled:opacity-50 disabled:cursor-not-allowed',
                                )}
                                title={canCompareRun ? 'Compare this run against another, side by side' : 'No replay — cap not verified'}
                            >
                                <Columns2 className="size-3.5" />
                                Compare Run
                            </button>
                            <button
                                type="button"
                                onClick={onDownload}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-hairline/[0.03] border border-hairline/10 text-muted-foreground hover:text-foreground hover:bg-hairline/[0.06] hover:border-hairline/20 transition-colors text-xs font-semibold cursor-pointer"
                            >
                                <Download className="size-3.5" />
                                Demo
                            </button>
                        </div>
                    </div>

                    <PlayerInfo userId={cap.user} alias={cap.alias} title={cap.active_title} size="lg" />

                    <div className="flex items-stretch gap-5 pt-3 border-t border-hairline/5">
                        <div className="flex flex-col justify-between">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cap Time</div>
                            <div className="text-4xl font-bold font-mono tabular-nums text-foreground leading-none">
                                {formatCapTime(cap.cap_time_seconds)}
                            </div>
                        </div>
                        <div className="self-stretch w-px bg-hairline/10" />
                        <MiniStat label="Rank">
                            <span className="text-foreground">#{rank}</span>{' '}
                            <span className="text-[10px] text-muted-foreground font-normal">of {total.toLocaleString()}</span>
                        </MiniStat>
                        <MiniStat label="Δ WR">
                            <span className={isWr ? 'text-muted-foreground' : deltaClass(deltaWr)}>
                                {isWr ? '—' : formatSignedDelta(deltaWr)}
                            </span>
                        </MiniStat>
                        <MiniStat label="Gap to Next">
                            <span className={isWr || gapToNext == null ? 'text-muted-foreground' : 'text-red-300'}>
                                {isWr || gapToNext == null ? '—' : formatSignedDelta(gapToNext)}
                            </span>
                        </MiniStat>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {showMedal && medalIcon && (
                            <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md bg-hairline/5 border border-hairline/10 text-xs font-semibold text-foreground">
                                <img src={medalIcon} alt={medalLabel} className="size-4 object-contain" />
                                {medalLabel}
                            </span>
                        )}
                        <span className={cn(
                            'inline-flex items-center gap-1.5 h-7 px-2 rounded-md border text-xs font-semibold',
                            cap.verified
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                : 'bg-hairline/5 border-hairline/10 text-muted-foreground',
                        )}>
                            <ShieldCheck className="size-3.5" />
                            {cap.verified ? 'Verified' : 'Unverified'}
                        </span>
                        <CapTypeBadge capType={cap.cap_type} />
                        {cap.added && (
                            <Tooltip content={friendlyDate(cap.added)} side="top">
                                <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md bg-hairline/5 border border-hairline/5 text-xs text-muted-foreground">
                                    <Calendar className="size-3.5" />
                                    {formatAddedDate(cap.added)}
                                </span>
                            </Tooltip>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
