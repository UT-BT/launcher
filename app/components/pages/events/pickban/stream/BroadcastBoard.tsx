import type { PickBanActor } from '@/app/utils/api'
import type { PickBanCardView } from '../pickBanView'
import { MapTile, type ActorLabels } from '../components/MapTile'
import { boardLayout } from './boardLayout'
import { broadcastBoardOf } from './broadcastMoment'

const BOARD_WIDTH = 1792

const BOARD_HEIGHT = 556

const BOARD_GAP = 22

const MAX_TILE = 320

interface BroadcastBoardProps {
    cards: PickBanCardView[]
    previewActor: PickBanActor | null
    actorLabels: ActorLabels
}

export function BroadcastBoard({ cards, previewActor, actorLabels }: BroadcastBoardProps) {
    const { cards: eligible, excludedLines } = broadcastBoardOf(cards)
    const layout = boardLayout(eligible.length, BOARD_WIDTH, BOARD_HEIGHT, BOARD_GAP, MAX_TILE)
    const focused = eligible.some(card => card.previewed)

    return (
        <div className="flex flex-col items-center gap-3">
            <ul
                className="flex flex-wrap content-center justify-center"
                style={{ width: layout.columns * layout.tile + (layout.columns - 1) * BOARD_GAP, gap: BOARD_GAP, height: BOARD_HEIGHT }}
            >
                {eligible.map(card => (
                    <li key={card.key} style={{ width: layout.tile, height: layout.tile }}>
                        <MapTile
                            card={card}
                            previewActor={previewActor}
                            actorLabels={actorLabels}
                            dimmed={focused && card.state === 'available' && !card.previewed}
                            imageSize="hero"
                        />
                    </li>
                ))}
            </ul>
            <p className="h-8 max-w-full truncate text-center text-lg font-bold uppercase leading-8 tracking-[0.18em] text-white/45">{excludedLines.join('   |   ')}</p>
        </div>
    )
}
