import { Fragment } from 'react'
import { cn } from '@/lib/utils'
import type { StandingsTeam, SwissCentre, SwissColumn, SwissPairing, SwissPath, SwissView } from './standingsView'
import { SWISS_CHIPS } from './standingsView'
import { LABEL, Panel, TEAM_NAME, sideWash } from './StandingsParts'

type ChipSize = (typeof SWISS_CHIPS)[number]

function TeamChip({ team, size, big = false }: { team: StandingsTeam; size: ChipSize; big?: boolean }) {
    return (
        <div
            data-side={team.side ?? undefined}
            className={cn('flex min-w-0 items-center gap-3 rounded-xl px-5', !team.side && 'bg-white/5')}
            style={{ height: size.height + (big ? 8 : 0), ...sideWash(team.side, 18) }}
        >
            <span className={cn(TEAM_NAME, !team.side && 'text-white/80')} style={{ fontSize: size.font + (big ? 1 : 0) }}>{team.name}</span>
        </div>
    )
}

function ColumnHead({ record, label, gold }: { record: string; label: string; gold: boolean }) {
    return (
        <div className="flex items-center justify-between gap-4 px-1 pb-1.5">
            <span className={cn('text-[56px] font-black italic leading-[0.9] tabular-nums', gold && 'text-pickban-gold')}>{record}</span>
            <span className={cn(LABEL, 'text-right', gold && 'text-pickban-gold')}>{label}</span>
        </div>
    )
}

function RecordColumn({ column, size }: { column: SwissColumn; size: ChipSize }) {
    return (
        <Panel className={cn('flex flex-col px-[22px] py-6', column.tone === 'out' && 'opacity-70')} style={{ gap: size.gap }}>
            <ColumnHead record={column.record} label={column.label} gold={column.tone === 'gold'} />
            {column.teams.map(team => <TeamChip key={team.id ?? team.name} team={team} size={size} />)}
        </Panel>
    )
}

function middleText(pairing: SwissPairing): string {
    if (pairing.score) return `${pairing.score.a}–${pairing.score.b}`
    if (pairing.current && pairing.live) return 'Live'
    return 'vs'
}

function Pairing({ pairing, size }: { pairing: SwissPairing; size: ChipSize }) {
    return (
        <div
            data-swiss-pairing={pairing.id}
            className={cn('grid grid-cols-[1fr_auto_1fr] items-center gap-3.5 rounded-[14px] p-3', pairing.current && 'bg-white/5 ring-2 ring-white/40')}
        >
            <TeamChip team={pairing.a} size={size} big={pairing.current} />
            <span className={cn('font-black italic uppercase text-white/60', pairing.current ? 'text-3xl' : 'text-2xl')}>{middleText(pairing)}</span>
            <TeamChip team={pairing.b} size={size} big={pairing.current} />
        </div>
    )
}

function PathLine({ path }: { path: SwissPath }) {
    return (
        <div className="flex min-w-0 items-center gap-3 whitespace-nowrap text-2xl font-bold uppercase tracking-[0.06em]">
            <span className="truncate">{path.name}</span>
            <span className="text-white/55">Path</span>
            {path.steps.length === 0 && <span className="text-white/55">No results yet</span>}
            {path.steps.map((step, index) => (
                <Fragment key={index}>
                    {index > 0 && <span className="text-white/30">›</span>}
                    <span className="truncate">{step}</span>
                </Fragment>
            ))}
        </div>
    )
}

function CentreColumn({ centre, paths, size }: { centre: SwissCentre; paths: SwissPath[]; size: ChipSize }) {
    return (
        <Panel className="flex min-w-0 flex-col gap-3 px-[22px] py-6">
            <ColumnHead record={centre.record} label={centre.label} gold={false} />
            <p className={cn(LABEL, 'px-1')}>{centre.line}</p>
            {centre.pairings.map(pairing => <Pairing key={pairing.id} pairing={pairing} size={size} />)}
            {paths.length > 0 && (
                <>
                    <div className="my-2 h-px bg-white/10" />
                    <div className="flex flex-col gap-2.5 px-1">
                        {paths.map(path => <PathLine key={path.side} path={path} />)}
                    </div>
                </>
            )}
        </Panel>
    )
}

export function StandingsSwiss({ view }: { view: SwissView }) {
    const size = SWISS_CHIPS[view.density]
    const columnStack = (columns: SwissColumn[]) => (
        <div className="flex min-w-0 flex-col gap-7">
            {columns.map(column => <RecordColumn key={column.key} column={column} size={size} />)}
        </div>
    )
    return (
        <div data-standings-kind="swiss" className="h-full pt-10">
            <div
                className="grid origin-top grid-cols-[400px_minmax(0,1fr)_400px] items-start gap-x-7"
                style={view.scale < 1 ? { transform: `scale(${view.scale})` } : undefined}
            >
                {columnStack(view.left)}
                {view.centre ? <CentreColumn centre={view.centre} paths={view.paths} size={size} /> : <div />}
                {columnStack(view.right)}
            </div>
        </div>
    )
}
