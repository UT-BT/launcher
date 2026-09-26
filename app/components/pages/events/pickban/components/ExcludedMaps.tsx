import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { displayMapName } from '@/app/utils/format'
import type { PickBanCardView } from '../pickBanView'

export function excludedCardsOf(cards: PickBanCardView[]): PickBanCardView[] {
    return cards.filter(card => card.state === 'excluded')
}

export function eligibleCardsOf(cards: PickBanCardView[]): PickBanCardView[] {
    return cards.filter(card => card.state !== 'excluded')
}

export function exclusionReasonsOf(cards: PickBanCardView[]): string[] {
    return [...new Set(cards.flatMap(card => (card.state === 'excluded' && card.exclusionReason ? [card.exclusionReason] : [])))]
}

export function ExcludedMaps({ cards }: { cards: PickBanCardView[] }) {
    const excluded = excludedCardsOf(cards)
    if (excluded.length === 0) return null

    return (
        <div className="flex w-full flex-col items-center gap-2 border-t border-hairline/10 pt-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Excluded</p>
            <ul className="flex flex-wrap justify-center gap-2">
                {excluded.map(card => (
                    <li
                        key={card.key}
                        title={card.exclusionReason ?? card.map}
                        className="flex min-w-0 items-center gap-2 rounded-lg border border-hairline/10 bg-hairline/5 py-1 pl-1 pr-2.5"
                    >
                        <MapThumbnail mapName={card.map} version={card.screenshotVersion} size="thumb" alt="" className="size-7 rounded-md border-0 opacity-60 grayscale" />
                        <span className="truncate font-pickban text-sm font-bold uppercase text-muted-foreground">{displayMapName(card.map)}</span>
                        <span className="sr-only">{card.exclusionReason ? `, excluded: ${card.exclusionReason}` : ', excluded'}</span>
                    </li>
                ))}
            </ul>
            {exclusionReasonsOf(cards).map(reason => (
                <p key={reason} className="text-center text-xs text-muted-foreground">{reason}</p>
            ))}
        </div>
    )
}
