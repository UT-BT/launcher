import { cn } from '@/lib/utils'
import type { GroupMatchLine, GroupRow, GroupView } from './standingsView'
import { KICKER, LABEL, Panel, TEAM_NAME, sideWash } from './StandingsParts'

const COLUMNS_WITH_DRAWS = '54px minmax(0,1fr) 60px 46px 38px 38px 38px 96px 92px 64px'
const COLUMNS_WITHOUT_DRAWS = '54px minmax(0,1fr) 60px 46px 38px 38px 96px 92px 64px'
const ZONE_BAR = { top: 'bg-pickban-gold', next: 'bg-white/35' } as const

function GroupTableRow({ row, showDraws, columns, rowHeight, fontSize }: { row: GroupRow; showDraws: boolean; columns: string; rowHeight: number; fontSize: number }) {
    const numbers = [row.seed ?? '–', row.played, row.wins, ...(showDraws ? [row.draws] : []), row.losses, row.maps, row.caps]
    return (
        <div
            data-standings-row={row.teamId}
            data-side={row.side ?? undefined}
            className={cn('grid items-center text-center font-bold tabular-nums', !row.side && 'text-white/75')}
            style={{ gridTemplateColumns: columns, height: rowHeight, fontSize, ...sideWash(row.side, 16) }}
        >
            <span className="flex items-center justify-center gap-2.5">
                <span className={cn('w-1.5 rounded-[3px]', row.zone && ZONE_BAR[row.zone])} style={{ height: Math.round(rowHeight * 0.55) }} />
                {row.rank}
            </span>
            <span className="flex min-w-0 items-center gap-3 pl-2.5 text-left">
                <span className={TEAM_NAME}>{row.name}</span>
            </span>
            {numbers.map((value, index) => <span key={index}>{value}</span>)}
            <span className="font-black italic" style={{ fontSize: fontSize + 4 }}>{row.points}</span>
        </div>
    )
}

function GroupTable({ group }: { group: GroupView['group'] }) {
    const { rows, showDraws, fit } = group
    const columns = showDraws ? COLUMNS_WITH_DRAWS : COLUMNS_WITHOUT_DRAWS
    const heads = ['#', 'Team', 'Seed', 'P', 'W', ...(showDraws ? ['D'] : []), 'L', 'Maps', 'Caps ±', 'Pts']
    return (
        <div className="origin-top-left" style={fit.scale < 1 ? { transform: `scale(${fit.scale})`, width: `${100 / fit.scale}%` } : undefined}>
            <div className="grid pb-2.5 text-center text-base font-bold uppercase tracking-[0.16em] text-white/50" style={{ gridTemplateColumns: columns }}>
                {heads.map(head => <span key={head} className={cn('whitespace-nowrap', head === 'Team' && 'pl-2.5 text-left')}>{head}</span>)}
            </div>
            {rows.map(row => (
                <GroupTableRow key={row.teamId} row={row} showDraws={showDraws} columns={columns} rowHeight={fit.rowHeight} fontSize={fit.fontSize} />
            ))}
        </div>
    )
}

function MatchLine({ line }: { line: GroupMatchLine }) {
    return (
        <div className="mt-3.5 first:mt-4">
            <p className="truncate text-[26px] font-black italic uppercase">
                {line.a}{' '}
                {line.score
                    ? <span className="text-pickban-gold">{line.score.a}–{line.score.b}</span>
                    : <span className="text-white/50">vs</span>}
                {' '}{line.b}
            </p>
            <p className="text-lg uppercase tracking-[0.08em] text-white/55">{line.time}</p>
        </div>
    )
}

export function StandingsGroups({ view }: { view: GroupView }) {
    const { group, zones, thisMatch, alsoToday } = view
    return (
        <div data-standings-kind="groups" className="grid h-full grid-cols-[1260px_1fr] gap-x-10">
            <Panel className="min-h-0 overflow-hidden px-[26px] py-7">
                <div className="flex items-center justify-between gap-6 px-2.5 pb-[18px]">
                    <p className="truncate text-[44px] font-black italic uppercase leading-none">{group.name}</p>
                    {group.pointsRule && <p className={cn(LABEL, 'shrink-0')}>{group.pointsRule}</p>}
                </div>
                <GroupTable group={group} />
            </Panel>
            <div className="flex min-h-0 min-w-0 flex-col gap-6">
                {zones.length > 0 && (
                    <Panel className="px-7 py-[26px]">
                        <p className={KICKER}>Where they go</p>
                        {zones.map(zone => (
                            <p key={zone.label} className="mt-3 flex items-center gap-3.5 text-[28px] font-bold uppercase first-of-type:mt-[18px]">
                                <span className={cn('h-[34px] w-2 shrink-0 rounded-[3px]', ZONE_BAR[zone.zone])} />
                                <span className="truncate">{zone.label}</span>
                            </p>
                        ))}
                    </Panel>
                )}
                <Panel className="px-7 py-[26px]">
                    <p className={KICKER}>This match</p>
                    {(['a', 'b'] as const).map(side => (
                        <p key={side} className={cn('flex items-center gap-3 text-4xl font-black italic uppercase', side === 'a' ? 'mt-[18px]' : 'mt-2.5')}>
                            <span className="truncate">{thisMatch[side]}</span>
                        </p>
                    ))}
                    <p className="mt-4 text-2xl font-bold uppercase tracking-[0.08em] text-pickban-gold">{thisMatch.time}</p>
                </Panel>
                {alsoToday.length > 0 && (
                    <Panel className="min-h-0 flex-1 overflow-hidden px-7 py-[26px]">
                        <p className={KICKER}>Also in {group.name} today</p>
                        {alsoToday.map(line => <MatchLine key={line.id} line={line} />)}
                    </Panel>
                )}
            </div>
        </div>
    )
}
