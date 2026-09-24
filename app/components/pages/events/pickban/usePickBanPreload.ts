import type { PickBanCardView } from './pickBanView'

export type PickBanPreloadCard = Pick<PickBanCardView, 'map' | 'screenshotVersion' | 'state'>

export function usePickBanPreload(cards: readonly PickBanPreloadCard[] | null | undefined): boolean {
    void cards
    return true
}
