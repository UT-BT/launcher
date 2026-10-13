import { SIDE_COLORS, type SideColor } from '@/app/utils/api'
import { sideColorTag, sideColorTone } from '@/app/utils/sideLabels'
import type { PlateTag } from '@/app/components/broadcast/TeamPlate'
import type { PickBanSideCardView, PickBanSideReveal, PickBanTeamPanel, PickBanTimelineEntry, PickBanView } from '../pickBanView'

export interface BroadcastSideOption {
    color: SideColor
    tag: string
    lead: string
}

export type BroadcastMoment =
    | { kind: 'intro'; sidesLine: string | null }
    | { kind: 'side_choice'; chooser: string; options: BroadcastSideOption[] }
    | { kind: 'side_reveal'; reveal: PickBanSideReveal }
    | { kind: 'reveal'; entry: PickBanTimelineEntry }
    | { kind: 'lineup' }
    | { kind: 'notice'; notice: 'cancelled' | 'voided' }

const PLAIN_LEADS: Record<SideColor, string> = { red: 'Acts first', blue: 'Acts second' }

function sideOptionsOf(cards: PickBanSideCardView[]): BroadcastSideOption[] {
    return SIDE_COLORS.map(color => ({
        color,
        tag: sideColorTag(color),
        lead: cards.find(card => card.color === color)?.lead ?? PLAIN_LEADS[color],
    }))
}

export function broadcastMomentOf(view: PickBanView): BroadcastMoment | null {
    const { side } = view
    if (side.phase === 'side_choice') return { kind: 'side_choice', chooser: side.chooserName ?? 'A team', options: sideOptionsOf(side.cards) }
    if (side.phase === 'side_spotlight' && side.reveal) return { kind: 'side_reveal', reveal: side.reveal }
    switch (view.stagePhase) {
        case 'intro':
            return { kind: 'intro', sidesLine: side.introLine }
        case 'spotlight':
            return view.spotlight ? { kind: 'reveal', entry: view.spotlight } : null
        case 'complete':
            return { kind: 'lineup' }
        case 'cancelled':
        case 'voided':
            return { kind: 'notice', notice: view.stagePhase }
        default:
            return null
    }
}

export function plateSideTagOf(view: PickBanView, panel: PickBanTeamPanel | null): PlateTag | null {
    if (!panel || !view.side.confirmed || view.side.phase === 'side_choice') return null
    return { label: sideColorTag(panel.color), tone: sideColorTone(panel.color) }
}

function halfOf(view: PickBanView, side: PickBanTeamPanel['side']): 'left' | 'right' | null {
    if (view.teams.left?.side === side) return 'left'
    if (view.teams.right?.side === side) return 'right'
    return null
}

export function broadcastBackdropLit(view: PickBanView): 'left' | 'right' | null {
    if (view.side.reveal) return halfOf(view, view.side.reveal.side)
    const acting = view.stagePhase === 'awaiting' ? view.turn?.ab ?? null : view.stagePhase === 'spotlight' ? view.spotlight?.actor ?? null : null
    if (acting === 'A') return 'left'
    if (acting === 'B') return 'right'
    return null
}
