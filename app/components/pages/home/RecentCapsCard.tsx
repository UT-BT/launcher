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

const CAP_COLUMNS: (Omit<ResponsiveColumn, 'id'> & { id: CapColumnId; align?: 'center' })[] = [
    { id: 'map', required: true, tier: 'essential', label: 'Map' },
    { id: 'holder', width: '9rem', priority: 20, tier: 'essential', label: 'Holder' },
    { id: 'time', width: '6rem', priority: 70, required: true, tier: 'essential', label: 'Time', align: 'center' },
    { id: 'when', width: '7rem', priority: 30, tier: 'essential', label: 'When', align: 'center' },
    { id: 'replay', width: '3rem', priority: 40, tier: 'essential', label: 'Watch replay', align: 'center' },
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

    const teamCapIdOf = (cap: Achievement) => cap.isTeam ? cap.teamCapId ?? null : null
    const openAchievement = (cap: Achievement) => {
        const teamCapId = teamCapIdOf(cap)
        return teamCapId ? openTeamCap(teamCapId) : openCap(cap.id)
    }

    const capHolder = (cap: Achievement) => cap.teamMembers && cap.teamMembers.length > 0 ? (
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
    )

    const capCell = (id: CapColumnId, cap: Achievement): React.ReactNode => {
        switch (id) {
            case 'map':
                return (
                    <div className="flex items-center gap-2 min-w-0">
                        <MapNameCell
                            mapName={cap.mapName}
                            favorited={favoriteMapNames.has(cap.mapName)}
                            onToggleFavorite={onToggleFavorite}
                            onMapSelect={onMapSelect}
                        />
                    </div>
                )
            case 'holder':
                return <div className="flex justify-center">{capHolder(cap)}</div>
            case 'time': {
                const medalIcon = getMedalIcon(cap.medal)
                const teamCapId = teamCapIdOf(cap)
                return (
                    <div className="flex items-center justify-center gap-1.5">
                        {medalIcon && <img src={medalIcon} alt={cap.medal} className="size-3.5 shrink-0" />}
                        <CapTimeLink
                            capId={teamCapId ? undefined : cap.id}
                            teamCapId={teamCapId ?? undefined}
                            seconds={cap.time}
                            className="font-mono tabular-nums font-bold text-amber-300"
                        />
                    </div>
                )
            }
            case 'when':
                return <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{cap.timeAgo}</span>
            case 'replay':
                return cap.verified && (
                    <IconActionButton
                        variant="replay"
                        icon={Play}
                        iconFill
                        tooltip="Watch Replay"
                        loading={loadingCapId === cap.id}
                        onClick={() => onWatchReplay(cap)}
                    />
                )
        }
    }

    const columns: ResponsiveColumn<Achievement>[] = CAP_COLUMNS.map(({ align: _align, ...column }) => ({
        ...column,
        cell: cap => capCell(column.id, cap),
    }))

    const capFace = (cap: Achievement) => (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0 space-y-1.5">
                {capCell('map', cap)}
                {capHolder(cap)}
            </div>
            <div className="flex flex-col items-end gap-1">
                {capCell('time', cap)}
                <div className="flex items-center gap-2">
                    {capCell('when', cap)}
                    {capCell('replay', cap)}
                </div>
            </div>
        </div>
    )

    return (
        <DataTableShell
            className="!flex-none"
            responsive={{
                columns,
                onResolve: handleResolve,
                compactAriaLabel: 'Your latest caps',
                cards: {
                    rows,
                    rowKey: cap => cap.id,
                    face: capFace,
                    onOpen: openAchievement,
                },
            }}
        >
            <DataTableHeaderRow>
                <DataTableHeaderCell align="center">Map</DataTableHeaderCell>
                {isVisible('holder') && <DataTableHeaderCell align="center" width="9rem"></DataTableHeaderCell>}
                {isVisible('time') && <DataTableHeaderCell align="center" width="6rem">Time</DataTableHeaderCell>}
                {isVisible('when') && <DataTableHeaderCell align="center" width="7rem">When</DataTableHeaderCell>}
                {isVisible('replay') && <DataTableHeaderCell align="center" width="3rem" />}
            </DataTableHeaderRow>
            <tbody>
                {rows.map(cap => (
                    <DataTableRow
                        key={cap.id}
                        className="cursor-pointer"
                        onClick={() => openAchievement(cap)}
                    >
                        {CAP_COLUMNS.filter(column => isVisible(column.id)).map(column => (
                            <DataTableCell key={column.id} align={column.align}>
                                {capCell(column.id, cap)}
                            </DataTableCell>
                        ))}
                    </DataTableRow>
                ))}
            </tbody>
        </DataTableShell>
    )
}
