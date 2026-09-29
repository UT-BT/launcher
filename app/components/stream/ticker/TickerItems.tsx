import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { PICK_BAN_TONES } from '@/app/components/broadcast/broadcastTone'
import type { TickerItem } from './tickerModel'

const GOLD = PICK_BAN_TONES.gold.text
const DIM = 'text-white/55'

function Versus({ teams }: { teams: [string, string] }) {
    return <span>{teams[0]} vs {teams[1]}</span>
}

export function TickerItemView({ item }: { item: TickerItem }) {
    switch (item.kind) {
        case 'result':
            return (
                <>
                    <span>
                        {item.teams[0]} <span className={GOLD}>{item.score}</span> {item.teams[1]}
                    </span>
                    <span className={DIM}>{item.where}</span>
                </>
            )
        case 'upcoming':
            return (
                <>
                    <span className={GOLD}>{item.when}</span>
                    <Versus teams={item.teams} />
                    <span className={DIM}>{item.channel ?? 'Not streamed'}</span>
                </>
            )
        case 'predictor':
            return (
                <>
                    <span className={GOLD}>#{item.rank}</span>
                    <span className="flex items-center [&_img]:size-10 [&_span]:text-[26px]">
                        <PlayerInfo userId={item.userId} alias={item.alias} size="md" presentation="full" interactive={false} />
                    </span>
                    <span className={item.profit.startsWith('−') ? 'text-red-300' : 'text-emerald-300'}>{item.profit}</span>
                </>
            )
        case 'next':
            return (
                <>
                    <Versus teams={item.teams} />
                    <span className={DIM}>{item.channel ?? 'Not streamed'}</span>
                    <span className={GOLD}>{item.when}</span>
                </>
            )
    }
}
