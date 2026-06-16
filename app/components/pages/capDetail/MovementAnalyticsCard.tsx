import { Info } from 'lucide-react'
import { Tooltip } from '@/app/components/ui/tooltip'
import { toNum } from './capStats'
import type { CapRecord } from '@/app/utils/api'

interface MovementAnalyticsCardProps {
    cap: CapRecord
}

function fmtSec(v: number | null): string {
    return v != null ? `${v.toFixed(3)}s` : '—'
}

function StatTile({ label, value, description }: { label: string; value: string; description: string }) {
    return (
        <div className="bg-hairline/[0.02] border border-hairline/5 rounded-lg px-3 py-2.5 flex flex-col gap-1 h-full">
            <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</span>
                <Tooltip content={description} side="top">
                    <Info className="size-3 text-muted-foreground/60 shrink-0" />
                </Tooltip>
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-foreground">{value}</div>
        </div>
    )
}

export function MovementAnalyticsCard({ cap }: MovementAnalyticsCardProps) {
    const dodgeAfterLanding = toNum(cap.dodge_after_landing_50pc)
    const dodgeInitAfterLanding = toNum(cap.dodge_init_after_landing_50pc)
    const timeBetweenDodges = toNum(cap.time_between_dodges_50pc)

    const totalDodges = toNum(cap.dodge_block_count)
    const bindUses = totalDodges != null ? Math.min(toNum(cap.dodge_bind_uses) ?? 0, totalDodges) : null
    const normalDodges = totalDodges != null ? Math.max(totalDodges - (bindUses ?? 0), 0) : null
    const normalPct = totalDodges && totalDodges > 0 ? ((normalDodges ?? 0) / totalDodges) * 100 : 0
    const bindPct = totalDodges && totalDodges > 0 ? ((bindUses ?? 0) / totalDodges) * 100 : 0

    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl">
            <div className="px-4 py-3 border-b border-hairline/5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium text-center">
                Movement
            </div>

            <div className="p-4 space-y-4">
                <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">Dodge timing</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-stretch">
                        <StatTile
                            label="Dodge After Landing"
                            value={fmtSec(dodgeAfterLanding)}
                            description="Your typical time before dodging again after landing, across this run."
                        />
                        <StatTile
                            label="Dodge Init After Landing"
                            value={fmtSec(dodgeInitAfterLanding)}
                            description="Your typical time to begin a dodge after landing, across this run."
                        />
                        <StatTile
                            label="Time Between Dodges"
                            value={fmtSec(timeBetweenDodges)}
                            description="Your typical time between consecutive dodges, across this run."
                        />
                    </div>
                </div>

                <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">Dodges</div>
                    <div className="bg-hairline/[0.02] border border-hairline/5 rounded-lg px-4 py-3">
                        <div className="flex items-end justify-between gap-3 flex-wrap">
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-2xl font-bold font-mono tabular-nums text-foreground">
                                    {totalDodges != null ? totalDodges : '—'}
                                </span>
                                <span className="text-xs text-muted-foreground">total dodges</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                    <span className="inline-block size-2 rounded-full bg-emerald-400" />
                                    <span className="text-foreground font-mono tabular-nums">{normalDodges ?? '—'}</span> normal
                                </span>
                                <Tooltip content="Dodges performed using a single-key dodge bind rather than a manual double-tap." side="top">
                                    <span className="flex items-center gap-1.5 text-muted-foreground cursor-default">
                                        <span className="inline-block size-2 rounded-full bg-blue-400" />
                                        <span className="text-foreground font-mono tabular-nums">{bindUses ?? '—'}</span> bind
                                    </span>
                                </Tooltip>
                            </div>
                        </div>
                        {totalDodges != null && totalDodges > 0 && (
                            <div className="mt-2.5 h-2 rounded-full overflow-hidden flex bg-hairline/5">
                                <div className="bg-emerald-500/70" style={{ width: `${normalPct}%` }} />
                                <div className="bg-blue-500/70" style={{ width: `${bindPct}%` }} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
