import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import type { PickBanMember } from '@/app/utils/api'
import type { PickBanTeamPanel } from '../pickBanView'
import { PICK_BAN_TONES, teamTone } from './pickBanTone'

interface TeamPanelProps {
    panel: PickBanTeamPanel | null
    className?: string
}

export function TeamPanel({ panel, className }: TeamPanelProps) {
    const tone = PICK_BAN_TONES[teamTone(panel?.ab ?? null)]
    const onTurn = panel?.onTurn ?? false

    return (
        <section
            aria-label={panel?.name ?? 'Team to be decided'}
            className={cn(
                '@container/team min-w-0 rounded-xl border bg-gradient-to-b to-transparent to-60% p-3 transition-shadow',
                tone.wash,
                onTurn ? cn('ring-2', tone.border, tone.ring) : 'border-hairline/10',
                className,
            )}
        >
            <div className="flex flex-col gap-3 @[13rem]/team:gap-4">
                <div className="flex flex-wrap items-center gap-1.5">
                    {panel?.ab && (
                        <span className={cn('inline-flex size-5 items-center justify-center rounded text-[11px] font-black', tone.solid, tone.onSolid)}>
                            {panel.ab}
                        </span>
                    )}
                    {panel?.stageSeed != null && (
                        <span className={cn('rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider', tone.text, tone.line, tone.soft)}>
                            Seed {panel.stageSeed}
                        </span>
                    )}
                </div>
                <div className="space-y-1">
                    <h2 className="line-clamp-2 break-words text-base font-bold leading-tight text-foreground @[13rem]/team:text-xl @[20rem]/team:text-3xl">
                        {panel?.name ?? 'TBD'}
                    </h2>
                    <p className={cn('flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider', tone.text, !onTurn && 'invisible')}>
                        <span className={cn('size-1.5 rounded-full', tone.solid)} />
                        Contemplating…
                    </p>
                </div>
                {panel && (
                    <div className="space-y-2">
                        <ul className="flex flex-col gap-2">
                            {panel.members.map(member => (
                                <TeamMember key={member.id} member={member} />
                            ))}
                        </ul>
                        <p className="text-[11px] text-muted-foreground">
                            {panel.onlineCount} of {panel.members.length} online
                        </p>
                    </div>
                )}
            </div>
        </section>
    )
}

function TeamMember({ member }: { member: PickBanMember }) {
    const role = member.acting_captain ? 'Acting Captain' : member.captain ? 'Captain' : null

    return (
        <li className="flex min-w-0 items-center gap-2">
            <span
                title={member.online ? 'Online' : 'Offline'}
                className={cn('size-2 shrink-0 rounded-full', member.online ? 'bg-emerald-400' : 'bg-hairline/20')}
            >
                <span className="sr-only">{member.online ? 'Online' : 'Offline'}</span>
            </span>
            <PlayerInfo userId={member.id} alias={member.display_name} size="sm" className="min-w-0" />
            {role && (
                <span
                    title={role}
                    className="shrink-0 rounded border border-hairline/10 bg-hairline/5 px-1 py-px text-[9px] font-bold uppercase tracking-wider text-muted-foreground"
                >
                    <span aria-hidden>{member.acting_captain ? 'Acting' : 'C'}</span>
                    <span className="sr-only">{role}</span>
                </span>
            )}
        </li>
    )
}
