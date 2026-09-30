import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { toActiveTitle } from '@/app/utils/api'
import { staggeredCard } from '@/app/components/broadcast/broadcastMotion'
import { PICK_BAN_HUES, tint } from '@/app/components/broadcast/broadcastTone'
import { sideTone, sideToneClasses } from '../../sceneHelpers'
import type { StreamSide } from '../../data/streamHotState'
import type { CupRunChip, PreviewPlayerView, PreviewTeamView, ResultLetter } from './previewView'
import { Label, RESULT_TEXT } from './previewParts'

const PLATE_CLIP = 'polygon(0 0, 100% 0, calc(100% - 56px) 100%, 0 100%)'

const PILL: Record<ResultLetter, string> = {
    W: 'bg-emerald-500 text-white',
    D: 'bg-white/20 text-white',
    L: 'bg-red-400/20 text-red-300 shadow-[inset_0_0_0_2px_rgba(248,113,113,0.45)]',
}

function nameSize(name: string): number {
    if (name.length > 24) return 44
    if (name.length > 18) return 52
    return 60
}

function Chip({ className, children }: { className: string; children: string }) {
    return (
        <span className={cn('whitespace-nowrap rounded-md px-2.5 py-[3px] text-lg font-black italic uppercase leading-[1.1] tracking-[0.05em]', className)}>
            {children}
        </span>
    )
}

function Plate({ side, team }: { side: StreamSide; team: PreviewTeamView | null }) {
    const hue = PICK_BAN_HUES[sideTone(side)]
    const tone = sideToneClasses(side)
    const name = team?.name ?? 'TBD'

    return (
        <div className="relative h-[92px] shrink-0">
            <div aria-hidden className="absolute inset-0" style={{ clipPath: PLATE_CLIP, background: `linear-gradient(to right, ${tint(hue, 34)}, ${tint(hue, 12)} 55%, ${tint(hue, 4)})` }} />
            <div aria-hidden className={cn('absolute inset-y-0 left-0 w-2', tone.solid)} />
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-px" style={{ clipPath: PLATE_CLIP, background: `linear-gradient(to right, ${hue}, transparent 85%)` }} />
            <div className="relative flex h-full items-center justify-between gap-[18px] pl-11 pr-24">
                <div className="flex min-w-0 items-center gap-4">
                    <h2
                        className="min-w-0 truncate font-black italic uppercase leading-[0.95] tracking-tight [text-shadow:0_4px_24px_rgba(0,0,0,0.45)]"
                        style={{ fontSize: nameSize(name) }}
                    >
                        {name}
                    </h2>
                </div>
                {team && (
                    <div className="flex shrink-0 items-center gap-2.5">
                        {team.stageSeed !== null && <Chip className={cn('border-2', tone.border, tone.soft, tone.text)}>{`Stage seed ${team.stageSeed}`}</Chip>}
                        {team.preCupSeed !== null && <Chip className="border-2 border-white/30 bg-white/5 text-white">{`Pre-cup seed ${team.preCupSeed}`}</Chip>}
                        {team.odds && <Chip className={cn(tone.solid, tone.onSolid)}>{team.odds}</Chip>}
                    </div>
                )}
            </div>
        </div>
    )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="min-w-0">
            <p className="text-[15px] font-bold uppercase tracking-[0.16em] text-white/55">{label}</p>
            <p className="mt-1.5 text-[46px] font-black italic leading-[0.9] tabular-nums">{value}</p>
            {sub && <p className="mt-1 truncate text-base uppercase tracking-[0.08em] text-white/60">{sub}</p>}
        </div>
    )
}

function PlayerCard({ side, player, order }: { side: StreamSide; player: PreviewPlayerView; order: number }) {
    return (
        <motion.div
            variants={staggeredCard(order)}
            initial="hidden"
            animate="shown"
            className="min-w-0 rounded-3xl border border-l-4 border-white/10 bg-white/[0.04] px-6 py-5 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]"
            style={{ borderLeftColor: PICK_BAN_HUES[sideTone(side)] }}
        >
            <div className="max-w-full font-sans [zoom:1.55]">
                <PlayerInfo userId={player.id} alias={player.name} title={toActiveTitle(player.title)} size="lg" interactive={false} />
            </div>
            <div className="mt-4 grid grid-cols-[1fr_1.25fr_1fr] gap-4">
                <Stat label="Career caps" value={player.careerCaps} />
                <Stat label="WRs" value={player.wrs} sub={player.wrSplit} />
                <Stat label="Cup caps" value={player.cupCaps} />
            </div>
        </motion.div>
    )
}

function RunChip({ entry }: { entry: CupRunChip }) {
    return (
        <li className="flex min-w-0 max-w-[260px] items-center gap-2 whitespace-nowrap rounded-lg border border-white/[0.08] bg-white/[0.06] px-3 py-1.5 text-xl font-bold uppercase">
            <span className="shrink-0 text-white/50">{entry.round}</span>
            <span className={cn('shrink-0 font-black italic', entry.result ? RESULT_TEXT[entry.result] : 'text-white/60')}>
                {[entry.result, entry.score].filter(Boolean).join(' ')}
            </span>
            <span className="truncate">{entry.opponent}</span>
        </li>
    )
}

function FormPill({ result }: { result: ResultLetter | null }) {
    return (
        <span
            className={cn(
                'inline-flex size-[30px] items-center justify-center rounded-md text-lg font-black italic leading-none',
                result ? PILL[result] : 'shadow-[inset_0_0_0_2px_rgba(255,255,255,0.12)]',
            )}
        >
            {result}
        </span>
    )
}

export function PreviewTeamSection({ side, team, order }: { side: StreamSide; team: PreviewTeamView | null; order: number }) {
    return (
        <section aria-label={team?.name ?? 'Team to be decided'} data-preview-team={side} className="flex h-[400px] min-w-0 flex-col gap-3.5">
            <motion.div variants={staggeredCard(order)} initial="hidden" animate="shown">
                <Plate side={side} team={team} />
            </motion.div>
            {team && (
                <>
                    <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
                        {team.players.map((player, index) => (
                            <PlayerCard key={player.id} side={side} player={player} order={order + 1 + index} />
                        ))}
                    </div>
                    <div className="flex h-11 shrink-0 items-center gap-3 px-1">
                        <Label>Cup run</Label>
                        <ol className="flex min-w-0 items-center gap-3">
                            {team.cupRun.earlier > 0 && (
                                <li className="shrink-0 text-xl font-bold text-white/50">+{team.cupRun.earlier}</li>
                            )}
                            {team.cupRun.shown.map(entry => <RunChip key={entry.matchId} entry={entry} />)}
                            {team.cupRun.shown.length === 0 && <li className="text-xl font-bold uppercase text-white/40">First match</li>}
                        </ol>
                        <span className="flex-1" />
                        <Label>Form</Label>
                        <span className="flex shrink-0 items-center gap-1.5">
                            {team.form.map((result, index) => <FormPill key={index} result={result} />)}
                        </span>
                    </div>
                </>
            )}
        </section>
    )
}
