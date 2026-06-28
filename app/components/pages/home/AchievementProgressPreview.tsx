import { Award } from 'lucide-react'
import type { AchievementDefinition, AchievementProgress } from '@/app/utils/api'

function achievementName(definitions: Map<string, AchievementDefinition>, code: string): string {
    return definitions.get(code)?.name ?? code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

interface AchievementProgressPreviewProps {
    achievements: AchievementProgress[]
    definitions: Map<string, AchievementDefinition>
}

export function AchievementProgressPreview({ achievements, definitions }: AchievementProgressPreviewProps) {
    const rows = achievements
        .filter(a => !a.maxed && a.next_threshold != null)
        .sort((a, b) => b.percent_to_next - a.percent_to_next)
        .slice(0, 6)

    if (achievements.length === 0) {
        return (
            <div className="bg-card/30 border border-hairline/5 rounded-xl flex flex-col items-center justify-center gap-2 py-8 text-center">
                <Award className="size-6 text-emerald-300/70" />
                <p className="text-xs text-muted-foreground">No achievement progress available yet.</p>
            </div>
        )
    }

    if (rows.length === 0) {
        return (
            <div className="bg-card/30 border border-hairline/5 rounded-xl flex flex-col items-center justify-center gap-2 py-8 text-center">
                <Award className="size-6 text-emerald-300/70" />
                <p className="text-xs text-muted-foreground">All visible achievements are maxed.</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-2 gap-2 max-h-[15.5rem] overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.25)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-hairline/20 sm:max-h-none sm:overflow-visible sm:pr-0">
            {rows.map(a => {
                const pct = Math.max(0, Math.min(100, a.percent_to_next || 0))
                const remaining = a.next_threshold == null ? 0 : Math.max(0, a.next_threshold - a.current_value)
                const unit = definitions.get(a.code)?.unit ?? 'left'
                return (
                    <div key={a.code} className="bg-card/30 border border-hairline/5 rounded-xl px-2 py-3 sm:px-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-semibold text-foreground truncate">{achievementName(definitions, a.code)}</div>
                                <div className="text-[11px] text-muted-foreground">
                                    {remaining.toLocaleString()} {unit} to go
                                </div>
                            </div>
                            <span className="text-xs font-bold font-mono tabular-nums text-emerald-300">{Math.round(pct)}%</span>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-hairline/10 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
