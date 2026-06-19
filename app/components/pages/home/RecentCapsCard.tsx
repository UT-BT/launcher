import { Play, Flag } from 'lucide-react'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell,
} from '@/app/components/shared/DataTable'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { MapNameCell } from '@/app/components/shared/MapNameCell'
import { CapTimeLink, openCap } from '@/app/components/shared/CapTimeLink'
import { IconActionButton } from '@/app/components/shared/IconActionButton'
import { getMedalIcon } from '@/app/utils/medals'
import type { Summary, ActiveTitle } from '@/app/utils/api'

type Achievement = Summary['achievements'][number]

interface RecentCapsCardProps {
    caps: Achievement[]
    playerUserId?: string | null
    playerAlias?: string | null
    playerTitle?: ActiveTitle | null
    favoriteMapNames: Set<string>
    onToggleFavorite: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
    onWatchReplay: (cap: Achievement) => void
    loadingCapId: string | null
    limit?: number
}

export function RecentCapsCard({
    caps, playerUserId, playerAlias, playerTitle, favoriteMapNames,
    onToggleFavorite, onMapSelect, onWatchReplay, loadingCapId, limit = 5,
}: RecentCapsCardProps) {
    const rows = caps.slice(0, limit)

    if (rows.length === 0) {
        return (
            <div className="bg-card/30 border border-hairline/5 rounded-xl flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Flag className="size-7 text-amber-300/70" />
                <p className="text-sm font-semibold text-foreground/80">No recent caps yet</p>
                <p className="text-xs text-muted-foreground">Go set a time.</p>
            </div>
        )
    }

    return (
        <DataTableShell className="!flex-none">
            <DataTableHeaderRow>
                <DataTableHeaderCell>Map</DataTableHeaderCell>
                <DataTableHeaderCell width="32%"></DataTableHeaderCell>
                <DataTableHeaderCell width="110px" align="right">Time</DataTableHeaderCell>
                <DataTableHeaderCell width="84px" align="right">When</DataTableHeaderCell>
                <DataTableHeaderCell width="52px" align="center" />
            </DataTableHeaderRow>
            <tbody>
                {rows.map(cap => {
                    const medalIcon = getMedalIcon(cap.medal)
                    return (
                        <DataTableRow
                            key={cap.id}
                            className="cursor-pointer"
                            onClick={() => openCap(cap.id)}
                        >
                            <DataTableCell>
                                <MapNameCell
                                    mapName={cap.mapName}
                                    favorited={favoriteMapNames.has(cap.mapName)}
                                    onToggleFavorite={onToggleFavorite}
                                    onMapSelect={onMapSelect}
                                />
                            </DataTableCell>
                            <DataTableCell>
                                <PlayerInfo
                                    userId={playerUserId ?? undefined}
                                    alias={playerAlias}
                                    title={playerTitle ?? null}
                                    size="sm"
                                />
                            </DataTableCell>
                            <DataTableCell align="right">
                                <div className="flex items-center justify-end gap-1.5">
                                    {medalIcon && <img src={medalIcon} alt={cap.medal} className="size-3.5 shrink-0" />}
                                    <CapTimeLink
                                        capId={cap.id}
                                        seconds={cap.time}
                                        className="font-mono tabular-nums font-bold text-amber-300"
                                    />
                                </div>
                            </DataTableCell>
                            <DataTableCell align="right">
                                <span className="text-xs text-muted-foreground tabular-nums">{cap.timeAgo}</span>
                            </DataTableCell>
                            <DataTableCell align="center">
                                {cap.verified && (
                                    <IconActionButton
                                        variant="replay"
                                        icon={Play}
                                        iconFill
                                        tooltip="Watch replay"
                                        loading={loadingCapId === cap.id}
                                        onClick={() => onWatchReplay(cap)}
                                    />
                                )}
                            </DataTableCell>
                        </DataTableRow>
                    )
                })}
            </tbody>
        </DataTableShell>
    )
}
