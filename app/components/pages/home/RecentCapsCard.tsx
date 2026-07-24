import { useCallback, useState } from 'react'
import { Play, Flag } from 'lucide-react'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell,
    type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { TeamAvatarStack } from '@/app/components/shared/TeamAvatarStack'
import { MapNameCell } from '@/app/components/shared/MapNameCell'
import { CapTimeLink, openCap, openTeamCap } from '@/app/components/shared/CapTimeLink'
import { IconActionButton } from '@/app/components/shared/IconActionButton'
import { getMedalIcon } from '@/app/utils/medals'
import type { Summary, ActiveTitle } from '@/app/utils/api'

type Achievement = Summary['achievements'][number]

type CapColumnId = 'map' | 'holder' | 'time' | 'when' | 'replay'

const CAP_COLUMNS: ResponsiveColumn[] = [
    { id: 'map', required: true },
    { id: 'holder', width: '9rem', priority: 20 },
    { id: 'time', width: '6rem', priority: 70, required: true },
    { id: 'when', width: '4rem', priority: 30 },
    { id: 'replay', width: '3rem', priority: 40 },
]

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

    const [resolved, setResolved] = useState<Set<CapColumnId> | null>(null)
    const handleResolve = useCallback((ids: Set<string>) => { setResolved(ids as Set<CapColumnId>) }, [])
    const isVisible = (id: CapColumnId) => !resolved || resolved.has(id)

    if (rows.length === 0) {
        return (
            <div className="bg-card/30 border border-hairline/5 rounded-xl flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Flag className="size-7 text-amber-300/70" />
                <p className="text-sm font-semibold text-foreground/80">No recent caps yet</p>
                <p className="text-xs text-muted-foreground">Go set a time.</p>
            </div>
        )
    }

    const compactRows = rows.map(cap => {
        const medalIcon = getMedalIcon(cap.medal)
        const teamCapId = cap.isTeam ? cap.teamCapId ?? null : null
        return (
            <div
                key={cap.id}
                role="listitem"
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 border-b border-hairline/5 last:border-0 cursor-pointer"
                onClick={() => teamCapId ? openTeamCap(teamCapId) : openCap(cap.id)}
            >
                <div className="min-w-0 space-y-1.5">
                    <MapNameCell
                        mapName={cap.mapName}
                        favorited={favoriteMapNames.has(cap.mapName)}
                        onToggleFavorite={onToggleFavorite}
                        onMapSelect={onMapSelect}
                    />
                    {cap.teamMembers && cap.teamMembers.length > 0 && (
                        <TeamAvatarStack members={cap.teamMembers} currentUserId={playerUserId} />
                    )}
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5">
                        {medalIcon && <img src={medalIcon} alt={cap.medal} className="size-3.5 shrink-0" />}
                        <CapTimeLink
                            capId={teamCapId ? undefined : cap.id}
                            teamCapId={teamCapId ?? undefined}
                            seconds={cap.time}
                            className="font-mono tabular-nums font-bold text-amber-300"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">{cap.timeAgo}</span>
                        {cap.verified && (
                            <IconActionButton
                                variant="replay"
                                icon={Play}
                                iconFill
                                tooltip="Watch Replay"
                                loading={loadingCapId === cap.id}
                                onClick={() => onWatchReplay(cap)}
                            />
                        )}
                    </div>
                </div>
            </div>
        )
    })

    return (
        <DataTableShell
            className="!flex-none"
            responsive={{
                columns: CAP_COLUMNS,
                onResolve: handleResolve,
                compactContent: compactRows,
                compactAriaLabel: 'Your latest caps',
            }}
        >
            <DataTableHeaderRow>
                <DataTableHeaderCell align="center">Map</DataTableHeaderCell>
                {isVisible('holder') && <DataTableHeaderCell align="center" width="9rem"></DataTableHeaderCell>}
                {isVisible('time') && <DataTableHeaderCell align="center" width="6rem">Time</DataTableHeaderCell>}
                {isVisible('when') && <DataTableHeaderCell align="center" width="4rem">When</DataTableHeaderCell>}
                {isVisible('replay') && <DataTableHeaderCell align="center" width="3rem" />}
            </DataTableHeaderRow>
            <tbody>
                {rows.map(cap => {
                    const medalIcon = getMedalIcon(cap.medal)
                    const teamCapId = cap.isTeam ? cap.teamCapId ?? null : null
                    return (
                        <DataTableRow
                            key={cap.id}
                            className="cursor-pointer"
                            onClick={() => teamCapId ? openTeamCap(teamCapId) : openCap(cap.id)}
                        >
                            <DataTableCell>
                                <div className="flex items-center gap-2 min-w-0">
                                    <MapNameCell
                                        mapName={cap.mapName}
                                        favorited={favoriteMapNames.has(cap.mapName)}
                                        onToggleFavorite={onToggleFavorite}
                                        onMapSelect={onMapSelect}
                                    />
                                </div>
                            </DataTableCell>
                            {isVisible('holder') && (
                                <DataTableCell>
                                    <div className="flex justify-center">
                                        {cap.teamMembers && cap.teamMembers.length > 0 ? (
                                            <TeamAvatarStack
                                                members={cap.teamMembers}
                                                currentUserId={playerUserId}
                                            />
                                        ) : (
                                            <PlayerInfo
                                                userId={playerUserId ?? undefined}
                                                alias={playerAlias}
                                                title={playerTitle ?? null}
                                                size="sm"
                                                />
                                        )}
                                    </div>
                                </DataTableCell>
                            )}
                            {isVisible('time') && (
                                <DataTableCell align="center">
                                    <div className="flex items-center justify-center gap-1.5">
                                        {medalIcon && <img src={medalIcon} alt={cap.medal} className="size-3.5 shrink-0" />}
                                        <CapTimeLink
                                            capId={teamCapId ? undefined : cap.id}
                                            teamCapId={teamCapId ?? undefined}
                                            seconds={cap.time}
                                            className="font-mono tabular-nums font-bold text-amber-300"
                                        />
                                    </div>
                                </DataTableCell>
                            )}
                            {isVisible('when') && (
                                <DataTableCell align="center">
                                    <span className="text-xs text-muted-foreground tabular-nums">{cap.timeAgo}</span>
                                </DataTableCell>
                            )}
                            {isVisible('replay') && (
                                <DataTableCell align="center">
                                    {cap.verified && (
                                        <IconActionButton
                                            variant="replay"
                                            icon={Play}
                                            iconFill
                                            tooltip="Watch Replay"
                                            loading={loadingCapId === cap.id}
                                            onClick={() => onWatchReplay(cap)}
                                        />
                                    )}
                                </DataTableCell>
                            )}
                        </DataTableRow>
                    )
                })}
            </tbody>
        </DataTableShell>
    )
}
