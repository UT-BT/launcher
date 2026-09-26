import type { PickBanActor } from '@/app/utils/api'
import { displayMapName } from '@/app/utils/format'
import type { PickBanCardView } from '../pickBanView'
import { eligibleCardsOf, excludedCardsOf } from '../components/ExcludedMaps'
import { MapTile, type ActorLabels } from '../components/MapTile'
import { boardLayout } from './boardLayout'

const BOARD_WIDTH = 1792

const BOARD_HEIGHT = 556

const BOARD_GAP = 22

const MAX_TILE = 320

interface BroadcastBoardProps {
    cards: PickBanCardView[]
    previewActor: PickBanActor | null
    actorLabels: ActorLabels
}

function excludedLines(cards: PickBanCardView[]): string[] {
    const byTag = new Map<string, string[]>()
    for (const card of excludedCardsOf(cards)) {
        const label = card.exclusion ? `${card.exclusion.tag} maps are out` : 'Excluded'
        byTag.set(label, [...(byTag.get(label) ?? []), displayMapName(card.map)])
    }
    return [...byTag].map(([label, maps]) => `${label}: ${maps.join(' · ')}`)
}

export function BroadcastBoard({ cards, previewActor, actorLabels }: BroadcastBoardProps) {
    const eligible = eligibleCardsOf(cards)
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
            <p className="h-8 max-w-full truncate text-center text-lg font-bold uppercase leading-8 tracking-[0.18em] text-white/45">{excludedLines(cards).join('   |   ')}</p>
        </div>
    )
}
