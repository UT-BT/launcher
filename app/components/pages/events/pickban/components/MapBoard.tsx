import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import type { PickBanActor } from '@/app/utils/api'
import type { PickBanCardView } from '../pickBanView'
import { MapTile, type ActorLabels } from './MapTile'
import { boardColumnVars } from './boardColumns'

interface MapBoardProps {
    cards: PickBanCardView[]
    previewActor: PickBanActor | null
    actorLabels: ActorLabels
    onSelect?: (map: string) => void
    className?: string
}

const COLUMNS = cn(
    '[--cols:var(--cols-0)] [--rows:var(--rows-0)] @xl/board:[--cols:var(--cols-1)] @xl/board:[--rows:var(--rows-1)]',
    '@3xl/board:[--cols:var(--cols-2)] @3xl/board:[--rows:var(--rows-2)] @5xl/board:[--cols:var(--cols-3)] @5xl/board:[--rows:var(--rows-3)]',
    '@7xl/board:[--cols:var(--cols-4)] @7xl/board:[--rows:var(--rows-4)] @[110rem]/board:[--cols:var(--cols-5)] @[110rem]/board:[--rows:var(--rows-5)]',
)

const TILE = cn(
    '[--gap:0.625rem] @3xl/board:[--gap:1rem]',
    '[--tile:min(18rem,calc((100cqw_-_(var(--cols)_-_1)_*_var(--gap))_/_var(--cols)))]',
    '@3xl/board:[--tile:min(18rem,calc((100cqw_-_(var(--cols)_-_1)_*_var(--gap))_/_var(--cols)),max(9rem,calc((100dvh_-_32rem_-_(var(--rows)_-_1)_*_var(--gap))_/_var(--rows))))]',
)

export function MapBoard({ cards, previewActor, actorLabels, onSelect, className }: MapBoardProps) {
    const focused = cards.some(card => card.previewed) && !cards.some(card => card.selected)

    return (
        <div className={cn('@container/board w-full p-1.5', className)}>
            <ul
                className={cn('mx-auto flex w-[calc(var(--cols)_*_var(--tile)_+_(var(--cols)_-_1)_*_var(--gap))] max-w-full flex-wrap justify-center gap-[var(--gap)]', COLUMNS, TILE)}
                style={boardColumnVars(cards.length) as CSSProperties}
            >
                {cards.map(card => (
                    <li key={card.key} className="size-[var(--tile)]">
                        <MapTile
                            card={card}
                            previewActor={previewActor}
                            actorLabels={actorLabels}
                            dimmed={focused && card.state === 'available' && !card.previewed}
                            imageSize="card"
                            onSelect={onSelect}
                        />
                    </li>
                ))}
            </ul>
        </div>
    )
}
