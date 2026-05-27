import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/app/components/ui/tooltip'
import { getMedalIcon } from '@/app/utils/medals'
import type { UserSummaryMedals } from '@/app/utils/api'

interface MedalShowcaseCardProps {
    medals: UserSummaryMedals | null
    loading: boolean
}

const ROWS: {
    key: keyof Pick<UserSummaryMedals, 'world_records' | 'champion_medals' | 'gold_medals' | 'silver_medals' | 'bronze_medals'>
    label: string
    medal: string
    accent: string
    multiplierLabel: string
}[] = [
    { key: 'world_records',   label: 'World Records', medal: 'world record',   accent: 'text-blue-300',   multiplierLabel: '' },
    { key: 'champion_medals', label: 'Champion',      medal: 'champion medal', accent: 'text-red-300',    multiplierLabel: 'WR + 2.5%' },
    { key: 'gold_medals',     label: 'Gold',          medal: 'gold medal',     accent: 'text-yellow-300', multiplierLabel: 'WR + 12.5%' },
    { key: 'silver_medals',   label: 'Silver',        medal: 'silver medal',   accent: 'text-slate-200',  multiplierLabel: 'WR + 30%' },
    { key: 'bronze_medals',   label: 'Bronze',        medal: 'bronze medal',   accent: 'text-amber-500',  multiplierLabel: 'WR + 60%' },
]

const EXPLAINER = (
    <div className="space-y-2 max-w-[260px]">
        <div className="text-[10px] uppercase tracking-wider font-bold text-blue-200">
            How medals are calculated
        </div>
        <p className="text-xs text-white/85 leading-relaxed">
            The World Record is the fastest verified cap.
        </p>
        <p className="text-xs text-white/85 leading-relaxed">
            Champion, Gold, Silver, and Bronze medals are calculated by multiplying the World Record by the factors shown below.
        </p>
        <div className="space-y-1 mt-2">
            {ROWS.filter(r => r.key !== 'world_records').map(r => (
                <div key={r.key} className="flex items-center justify-between gap-3 text-xs">
                    <span className={cn('font-semibold', r.accent)}>{r.label}</span>
                    <span className="font-mono text-white/70">{r.multiplierLabel}</span>
                </div>
            ))}
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed pt-1 border-t border-white/5">
            Only verified caps count toward WR.
        </p>
    </div>
)

export function MedalShowcaseCard({ medals, loading }: MedalShowcaseCardProps) {
    return (
        <div className="bg-card/30 border border-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Medals Earned
                </div>
                <Tooltip content={EXPLAINER} side="top">
                    <button
                        type="button"
                        aria-label="How medals are earned"
                        className="p-1 rounded text-muted-foreground hover:text-white hover:bg-white/5 transition-colors cursor-help"
                    >
                        <Info className="size-3.5" />
                    </button>
                </Tooltip>
            </div>

            <div className="space-y-2">
                {ROWS.map(row => {
                    const icon = getMedalIcon(row.medal)
                    const value = medals ? medals[row.key] : 0
                    return (
                        <div
                            key={row.key}
                            className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                {icon && <img src={icon} alt="" className="size-5 shrink-0" />}
                                <span className={cn('text-sm font-semibold truncate', row.accent)}>
                                    {row.label}
                                </span>
                            </div>
                            {loading ? (
                                <div className="h-4 w-10 bg-white/5 rounded animate-pulse" />
                            ) : (
                                <span className="text-sm font-mono tabular-nums font-bold text-white shrink-0">
                                    {value.toLocaleString()}
                                </span>
                            )}
                        </div>
                    )
                })}
            </div>

        </div>
    )
}
