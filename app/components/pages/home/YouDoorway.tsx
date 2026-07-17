import { Medal, Tag } from 'lucide-react'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { MetaPill } from '@/app/components/shared/MetaPill'
import { cn } from '@/lib/utils'
import { type ActiveTitle } from '@/app/utils/api'

interface YouDoorwayProps {
    userId?: string | null
    alias?: string | null
    title?: ActiveTitle | null
    worldRecords?: number | null
    className?: string
}

export function YouDoorway({ userId, alias, title, worldRecords, className }: YouDoorwayProps) {
    return (
        <div className={cn('relative overflow-hidden bg-card/30 border border-hairline/5 rounded-2xl backdrop-blur-xl', className)}>
            <div className="absolute inset-0 bg-gradient-to-r from-accent-500/[0.05] via-transparent to-accent-500/[0.02] pointer-events-none" />
            <div className="relative flex items-center justify-between gap-3 p-4 sm:p-5 h-full">
                <PlayerInfo
                    userId={userId ?? undefined}
                    alias={alias}
                    title={title ?? null}
                    size="lg"
                    showYouBadge
                    className="min-w-0"
                />
                <div className="flex items-center gap-2 shrink-0">
                    {worldRecords != null && worldRecords > 0 && (
                        <MetaPill icon={Medal} label="WRs" value={worldRecords.toLocaleString()} tone="blue" />
                    )}
                    <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent('open-change-title'))}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-hairline/5 border border-hairline/5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-hairline/10 transition-colors cursor-pointer"
                    >
                        <Tag className="size-3.5" />
                        {title ? 'Change title' : 'Pick a title'}
                    </button>
                </div>
            </div>
        </div>
    )
}
