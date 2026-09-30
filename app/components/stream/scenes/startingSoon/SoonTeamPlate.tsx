import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { toActiveTitle } from '@/app/utils/api'
import { PICK_BAN_HUES, tint } from '@/app/components/broadcast/broadcastTone'
import { sideTone, sideToneClasses } from '../../sceneHelpers'
import type { SoonTeam } from './startingSoonView'

const PLATE_CLIP = 'polygon(0 0, 100% 0, calc(100% - 56px) 100%, 0 100%)'
const PLATE_HEIGHT = 252
const PLAYER_ZOOM = 1.6

function nameSize(name: string): number {
    if (name.length > 26) return 60
    if (name.length > 21) return 70
    return 84
}

export function SoonTeamPlate({ team }: { team: SoonTeam }) {
    const tone = sideToneClasses(team.side)
    const hue = PICK_BAN_HUES[sideTone(team.side)]
    const name = team.name ?? 'TBD'

    return (
        <section aria-label={team.name ?? 'Team to be decided'} data-soon-team={team.side} className="relative min-w-0 shrink-0" style={{ height: PLATE_HEIGHT }}>
            <div
                aria-hidden
                className="absolute inset-0"
                style={{ clipPath: PLATE_CLIP, background: `linear-gradient(to right, ${tint(hue, 34)}, ${tint(hue, 12)} 55%, ${tint(hue, 4)})` }}
            />
            <div aria-hidden className={cn('absolute inset-y-0 left-0 w-2', tone.solid)} />
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-px" style={{ clipPath: PLATE_CLIP, background: `linear-gradient(to right, ${hue}, transparent 85%)` }} />
            <div className="relative flex h-full min-w-0 flex-col items-start justify-center gap-2.5 pl-12 pr-24">
                {team.seed !== null && <span className="text-lg font-bold uppercase tracking-[0.2em] text-white/70">Seed {team.seed}</span>}
                <h2
                    className="max-w-full truncate font-black italic uppercase leading-[0.9] tracking-tight text-white [text-shadow:0_4px_24px_rgba(0,0,0,0.45)]"
                    style={{ fontSize: nameSize(name) }}
                >
                    {name}
                </h2>
                {team.players.length > 0 && (
                    <ul className="flex min-w-0 max-w-full items-center gap-7 font-sans" style={{ zoom: PLAYER_ZOOM }}>
                        {team.players.map(player => (
                            <li key={player.id} className="min-w-0">
                                <PlayerInfo userId={player.id} alias={player.name} title={toActiveTitle(player.title)} size="md" interactive={false} />
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    )
}
