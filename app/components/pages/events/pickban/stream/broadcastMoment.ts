import { SIDE_COLORS, type SideColor } from '@/app/utils/api'
import { sideColorTag, sideColorTone } from '@/app/utils/sideLabels'
import type { PlateTag } from '@/app/components/broadcast/TeamPlate'
import { displayMapName } from '@/app/utils/format'
import type { PickBanCardView, PickBanSideCardView, PickBanSideReveal, PickBanTeamPanel, PickBanTimelineEntry, PickBanVetoReveal, PickBanView } from '../pickBanView'
import { eligibleCardsOf, excludedCardsOf } from '../components/ExcludedMaps'
import { nextStepLabel } from '../components/StageScenes'

export interface BroadcastSideOption {
    color: SideColor
    tag: string
    lead: string
}

export interface BroadcastVetoMap {
    map: string
    screenshotVersion: string | null
}

export interface BroadcastBoardCards {
    cards: PickBanCardView[]
    excludedLines: string[]
}

export type BroadcastMoment =
    | { kind: 'intro'; sidesLine: string | null }
    | { kind: 'veto_reveal'; tag: string; reveal: PickBanVetoReveal; maps: BroadcastVetoMap[]; next: string | null }
    | { kind: 'side_choice'; chooser: string; options: BroadcastSideOption[]; reason: string | null }
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

function vetoMapsOf(view: PickBanView, maps: string[]): BroadcastVetoMap[] {
    return maps.map(map => ({ map, screenshotVersion: view.cards.find(card => card.map === map)?.screenshotVersion ?? null }))
}

function afterVetoOf(view: PickBanView): string | null {
    const { side } = view
    if (!side.confirmed && side.chooserName) return `${side.chooserName} choose their side`
    const first = view.timeline[0]
    return first ? nextStepLabel(first) : null
}

export function broadcastMomentOf(view: PickBanView): BroadcastMoment | null {
    const { side, veto } = view
    if (veto?.phase === 'veto_spotlight' && veto.reveal) {
        return { kind: 'veto_reveal', tag: veto.tag, reveal: veto.reveal, maps: vetoMapsOf(view, veto.maps), next: afterVetoOf(view) }
    }
    if (side.phase === 'side_choice') {
        return {
            kind: 'side_choice',
            chooser: side.chooserName ?? 'A team',
            options: sideOptionsOf(side.cards),
            reason: veto ? side.chooserLine : null,
        }
    }
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
    if (view.veto?.reveal) return view.veto.reveal.side ? halfOf(view, view.veto.reveal.side) : null
    const acting = view.stagePhase === 'awaiting' ? view.turn?.ab ?? null : view.stagePhase === 'spotlight' ? view.spotlight?.actor ?? null : null
    if (acting === 'A') return 'left'
    if (acting === 'B') return 'right'
    return null
}

function vetoedByTeam(card: PickBanCardView): boolean {
    return card.vetoedBy !== null
}

export function broadcastBoardOf(cards: PickBanCardView[]): BroadcastBoardCards {
    const byTag = new Map<string, string[]>()
    for (const card of excludedCardsOf(cards).filter(card => !vetoedByTeam(card))) {
        const label = card.exclusion ? `${card.exclusion.tag} maps are out` : 'Excluded'
        byTag.set(label, [...(byTag.get(label) ?? []), displayMapName(card.map)])
    }
    const eligible = new Set(eligibleCardsOf(cards))
    return {
        cards: cards.filter(card => eligible.has(card) || vetoedByTeam(card)),
        excludedLines: [...byTag].map(([label, maps]) => `${label}: ${maps.join(' · ')}`),
    }
}
