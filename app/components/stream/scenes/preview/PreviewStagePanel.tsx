import { cn } from '@/lib/utils'
import { PICK_BAN_HUES, tint } from '@/app/components/broadcast/broadcastTone'
import { sideTone } from '../../sceneHelpers'
import type { StreamSide } from '../../data/streamHotState'
import { PREVIEW_SIDES, type GroupRowView, type NextStepView, type PathStepView, type PreviewStageViewModel, type SwissBucketView } from './previewView'
import { Kicker, Label, Panel, RESULT_TEXT } from './previewParts'

const GROUP_COLUMNS = 'grid grid-cols-[64px_minmax(0,1fr)_104px_92px_56px] items-center gap-x-2'

const BUCKET_TEXT: Record<SwissBucketView['status'], string> = {
    qualified: 'text-emerald-400',
    active: 'text-white',
    eliminated: 'text-red-300/80',
}

function markedStyle(side: StreamSide | null) {
    if (!side) return undefined
    const hue = PICK_BAN_HUES[sideTone(side)]
    return { background: tint(hue, 16), boxShadow: `inset 6px 0 0 ${hue}` }
}

function GroupRow({ row }: { row: GroupRowView }) {
    return (
        <li
            data-preview-row={row.side ?? undefined}
            className={cn(GROUP_COLUMNS, 'h-12 min-h-0 shrink rounded-sm px-2.5 text-[26px] font-bold tabular-nums', !row.side && 'text-white/75')}
            style={markedStyle(row.side)}
        >
            <span className="flex items-center gap-2.5">
                <span aria-hidden className="h-[26px] w-1.5 rounded-[3px] bg-white/35" />
                {row.rank}
            </span>
            <span className="flex min-w-0 items-center gap-3 font-black italic uppercase">
                <span className="truncate">{row.name}</span>
            </span>
            <span className="text-center">{row.record}</span>
            <span className="text-center">{row.maps}</span>
            <span className="text-center text-[30px] font-black italic">{row.points}</span>
        </li>
    )
}

function GroupTable({ rows }: { rows: GroupRowView[] }) {
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className={cn(GROUP_COLUMNS, 'shrink-0 px-2.5 pb-2.5 text-base font-bold uppercase leading-tight tracking-[0.16em] text-white/50')}>
                <span className="text-center">#</span>
                <span>Team</span>
                <span className="text-center">W–D–L</span>
                <span className="text-center">Maps</span>
                <span className="text-center">Pts</span>
            </div>
            <ol className="flex min-h-0 flex-1 flex-col">
                {rows.map(row => <GroupRow key={row.key} row={row} />)}
            </ol>
        </div>
    )
}

function SwissBuckets({ buckets }: { buckets: SwissBucketView[] }) {
    return (
        <ol className="flex min-h-0 flex-1 flex-col gap-2">
            {buckets.map(bucket => (
                <li
                    key={bucket.key}
                    className="flex h-16 min-h-0 shrink items-center gap-4 rounded-xl bg-white/[0.04] px-4"
                    style={markedStyle(bucket.marked.length === 1 ? bucket.marked[0].side : null)}
                >
                    <span className={cn('w-[150px] shrink-0 font-black italic uppercase tabular-nums', bucket.status === 'active' ? 'text-[34px]' : 'text-2xl', BUCKET_TEXT[bucket.status])}>
                        {bucket.label}
                    </span>
                    <Label className="w-[92px] shrink-0 text-[15px] text-white/45">{`${bucket.count} ${bucket.count === 1 ? 'team' : 'teams'}`}</Label>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                        {bucket.marked.map(entry => (
                            <span key={entry.side} className="flex min-w-0 items-center gap-2.5 text-[22px] font-black italic uppercase">
                                <span className="truncate">{entry.name}</span>
                            </span>
                        ))}
                    </span>
                </li>
            ))}
        </ol>
    )
}

const STEP_ROW = 'flex min-h-0 min-w-0 shrink items-center gap-3 rounded-lg px-3.5 py-2 text-[22px] font-bold uppercase leading-tight'
const STEP_ROUND = 'w-[150px] shrink-0 truncate text-base tracking-[0.12em] text-white/50'

function Opponent({ name }: { name: string }) {
    return (
        <span className="truncate">
            <span className="text-white/45">vs </span>
            {name}
        </span>
    )
}

function PathStep({ step }: { step: PathStepView }) {
    return (
        <li className={cn(STEP_ROW, step.current ? 'bg-white/10 ring-1 ring-white/25' : 'bg-white/[0.04]')}>
            <span className={STEP_ROUND}>{step.round}</span>
            {step.current ? (
                <span className="shrink-0 font-black italic text-pickban-gold">This match</span>
            ) : (
                <span className={cn('shrink-0 font-black italic', step.result ? RESULT_TEXT[step.result] : 'text-white/60')}>
                    {step.result ? `${step.result} ${step.score ?? ''}`.trim() : 'Next'}
                </span>
            )}
            <Opponent name={step.opponent} />
        </li>
    )
}

function BracketPaths({ names, paths, winnerPath }: { names: Record<StreamSide, string>; paths: Record<StreamSide, PathStepView[]>; winnerPath: NextStepView[] }) {
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-2">
            {PREVIEW_SIDES.map(side => (
                <div key={side} className="flex min-h-0 min-w-0 flex-col gap-2">
                    <p className="flex min-w-0 items-center gap-2.5 text-2xl font-black italic uppercase leading-tight">
                        <span className="truncate">{names[side]}</span>
                    </p>
                    <ol className="flex min-h-0 min-w-0 flex-col gap-1.5">
                        {paths[side].map(step => <PathStep key={step.matchId} step={step} />)}
                    </ol>
                </div>
            ))}
            {winnerPath.length > 0 && (
                <div className="flex min-h-0 min-w-0 flex-col gap-2">
                    <Label className="text-pickban-gold">Winner goes to</Label>
                    <ol className="flex min-h-0 min-w-0 flex-col gap-1.5">
                        {winnerPath.map(step => (
                            <li key={step.matchId} className={cn(STEP_ROW, 'bg-pickban-gold/10 ring-1 ring-pickban-gold/30')}>
                                <span className={STEP_ROUND}>{step.round}</span>
                                {step.waiting && <Opponent name={step.waiting} />}
                            </li>
                        ))}
                    </ol>
                </div>
            )}
        </div>
    )
}

export function PreviewStagePanel({ stage, order, grow }: { stage: PreviewStageViewModel; order: number; grow: boolean }) {
    return (
        <Panel order={order} className={cn('flex shrink flex-col gap-3.5 overflow-hidden px-5 pb-[18px] pt-[22px]', grow && 'flex-1')}>
            <div data-preview-stage={stage.kind} className="flex min-w-0 flex-col gap-1.5 px-2">
                <Kicker className="truncate">{stage.title}</Kicker>
                {stage.kind === 'swiss' && <Label className="truncate text-[15px] text-white/45">{stage.rule}</Label>}
            </div>
            {stage.kind === 'groups' && <GroupTable rows={stage.rows} />}
            {stage.kind === 'swiss' && <SwissBuckets buckets={stage.buckets} />}
            {stage.kind === 'single_elim' && <BracketPaths names={stage.names} paths={stage.paths} winnerPath={stage.winnerPath} />}
        </Panel>
    )
}
