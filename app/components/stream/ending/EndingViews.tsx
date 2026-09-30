import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { PICK_BAN_TONES } from '@/app/components/broadcast/broadcastTone'
import { SceneLogo } from '../frame/SceneBranding'
import type { EndingCredit, EndingMatch } from './endingModel'

const CREDIT_ZOOM = 2.2
const GOLD = PICK_BAN_TONES.gold

function TwitchGlyph() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#a970ff" aria-hidden>
            <path d="M4 2 2 6v14h5v3h3l3-3h4l5-5V2zm16 12-3 3h-5l-3 3v-3H5V4h15z" />
            <path d="M15 7h2v5h-2zm-5 0h2v5h-2z" />
        </svg>
    )
}

function Kicker({ children }: { children: string }) {
    return <p className="text-lg font-bold uppercase tracking-[0.3em] text-white/55">{children}</p>
}

function Hairline() {
    return <div className="my-2.5 h-px bg-white/10" />
}

function Credit({ credit }: { credit: EndingCredit }) {
    return (
        <div style={{ zoom: CREDIT_ZOOM }}>
            <PlayerInfo userId={credit.userId ?? undefined} alias={credit.name} size="lg" interactive={false} />
        </div>
    )
}

export function CreditsPanel({ streamer, casters, eventName }: { streamer: EndingCredit | null; casters: EndingCredit[]; eventName: string | null }) {
    return (
        <section aria-label="Credits" className="relative flex flex-col gap-[22px] rounded-3xl border border-white/10 bg-white/[0.04] px-9 py-[34px] shadow-2xl shadow-black/50">
            {streamer && (
                <>
                    <Kicker>Streamed by</Kicker>
                    <Credit credit={streamer} />
                </>
            )}
            {casters.length > 0 && (
                <>
                    {streamer && <Hairline />}
                    <Kicker>Casters</Kicker>
                    {casters.map(caster => (
                        <Credit key={caster.key} credit={caster} />
                    ))}
                </>
            )}
            {eventName && (
                <>
                    {(streamer || casters.length > 0) && <Hairline />}
                    <Kicker>Event</Kicker>
                    <div className="flex items-center gap-[18px]">
                        <SceneLogo className="size-[72px] object-contain" />
                        <p className="text-[34px] font-black italic uppercase leading-none">{eventName}</p>
                    </div>
                </>
            )}
        </section>
    )
}

function NextMatchRow({ match }: { match: EndingMatch }) {
    return (
        <li
            data-this-channel={match.thisChannel ? '' : undefined}
            className={cn(
                'grid grid-cols-[330px_1fr_auto] items-center gap-6 rounded-2xl px-[26px] py-5',
                match.thisChannel ? cn(GOLD.soft, 'ring-2', GOLD.ring) : 'bg-white/[0.04] ring-1 ring-white/[0.08]',
            )}
        >
            <div>
                <p className="text-[32px] font-black italic uppercase leading-tight">{match.when}</p>
                <p className={cn('text-[22px] font-bold uppercase tracking-widest', GOLD.text)}>{match.relative}</p>
            </div>
            <div className="min-w-0">
                <p className="truncate text-[38px] font-black italic uppercase leading-tight">
                    {match.teams[0]} <span className="text-white/50">vs</span> {match.teams[1]}
                </p>
                <p className="text-lg font-bold uppercase tracking-[0.14em] text-white/55">{match.where}</p>
            </div>
            <div className="text-right">
                <p className="flex items-center justify-end gap-2.5 text-[26px] font-bold">
                    {/^twitch\.tv\//i.test(match.channel) && <TwitchGlyph />}
                    {match.channel}
                </p>
                {match.thisChannel && (
                    <span className={cn('mt-2 inline-block rounded-md px-2.5 py-[3px] text-base font-black italic uppercase', GOLD.solid, GOLD.onSolid)}>
                        This channel
                    </span>
                )}
            </div>
        </li>
    )
}

export function NextMatches({ matches }: { matches: EndingMatch[] }) {
    return (
        <section aria-label="Next streamed matches">
            <p className="mb-[18px] text-lg font-bold uppercase tracking-[0.3em] text-white/55">Next streamed matches</p>
            {matches.length > 0 ? (
                <ul className="flex flex-col gap-4">
                    {matches.map(match => (
                        <NextMatchRow key={match.key} match={match} />
                    ))}
                </ul>
            ) : (
                <p className="text-[32px] font-bold uppercase tracking-widest text-white/40">No streamed matches scheduled yet</p>
            )}
            <p className="mt-7 text-[22px] font-bold uppercase tracking-[0.14em] text-white/50">Full schedule and results on utbt.net</p>
        </section>
    )
}
