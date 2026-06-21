import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { toNum } from './capStats'
import { getRegionFlag } from '@/app/utils/server-utils'
import { getTeamDisplay } from '@/app/utils/team'
import type { CapRecord } from '@/app/utils/api'

interface ClientSettingsGridProps {
    cap: CapRecord
    server: { name: string | null; region: string | null }
}

function Tile({ label, value, accent = 'text-foreground', className }: {
    label: string
    value: ReactNode
    accent?: string
    className?: string
}) {
    return (
        <div className={cn('bg-hairline/[0.02] border border-hairline/5 rounded-lg px-3 py-2 flex flex-col justify-center items-center text-center h-full', className)}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
            <div className={cn('text-sm font-semibold truncate max-w-full', accent)}>{value}</div>
        </div>
    )
}

function SpreadTile({ label, accent, cells }: {
    label: string
    accent: string
    cells: { p: string; v: number | null; suffix?: string }[]
}) {
    return (
        <div className="bg-hairline/[0.02] border border-hairline/5 rounded-lg px-3 py-2.5 flex flex-col justify-center h-full">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground text-center mb-2">{label}</div>
            <div className="flex items-start justify-around gap-2">
                {cells.map(c => (
                    <div key={c.p} className="text-center">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">{c.p}</div>
                        <div className={cn('text-sm font-mono font-semibold tabular-nums mt-0.5', accent)}>
                            {c.v != null ? `${c.v}${c.suffix ?? ''}` : '—'}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function ClientSettingsGrid({ cap, server }: ClientSettingsGridProps) {
    const spawnCount = toNum(cap.spawn_count)
    const deaths = spawnCount != null ? Math.max(spawnCount - 1, 0) : null
    const { name: team, accent: teamAccent } = getTeamDisplay(toNum(cap.team))
    const region = server.region ?? null

    const fpsCells = [
        { p: '1%', v: toNum(cap.fps_1pc) },
        { p: '5%', v: toNum(cap.fps_5pc) },
        { p: '25%', v: toNum(cap.fps_25pc) },
        { p: '50%', v: toNum(cap.fps_50pc) },
    ]
    const pingCells = [
        { p: '1%', v: toNum(cap.ping_1pc), suffix: 'ms' },
        { p: '5%', v: toNum(cap.ping_5pc), suffix: 'ms' },
        { p: '25%', v: toNum(cap.ping_25pc), suffix: 'ms' },
        { p: '50%', v: toNum(cap.ping_50pc), suffix: 'ms' },
    ]
    const netspeedCells = [
        { p: 'Min', v: toNum(cap.netspeed_min) },
        { p: 'Max', v: toNum(cap.netspeed_max) },
    ]

    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl shrink-0">
            <div className="px-4 py-3 border-b border-hairline/5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium text-center">
                Client/Server
            </div>
            <div className="p-3 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 items-stretch">
                    <Tile label="Server Region" value={
                        <span className="inline-flex items-center justify-center gap-1.5">
                            {region && <img src={getRegionFlag(region)} alt={region} className="size-4 rounded-sm object-cover" />}
                            <span className="truncate">{region ?? '—'}</span>
                        </span>
                    } />
                    <Tile label="Team" value={team} accent={teamAccent} />
                    <Tile label="Deaths" value={deaths ?? '—'} accent="text-amber-300" />
                    <Tile label="Engine" value={cap.engine || '—'} />
                    <Tile label="Renderer" value={cap.renderer || '—'} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-stretch">
                    <SpreadTile label="FPS" accent="text-emerald-300" cells={fpsCells} />
                    <SpreadTile label="Ping" accent="text-blue-300" cells={pingCells} />
                    <SpreadTile label="Netspeed" accent="text-foreground" cells={netspeedCells} />
                </div>
            </div>
        </div>
    )
}
