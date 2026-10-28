import {
    linkEventMatchMapCaps,
    type EventCapFlagReason, type EventCapReviewItem, type EventMatch, type EventSide, type SideColor,
} from '@/app/utils/api'
import { SIDES_TBC, sideColorName, sideColorTitle } from '@/app/utils/sideLabels'
import type { CapLinkPrefill } from '../capLinkRuns'

export type ReviewSideColors = Record<EventSide, SideColor | null>

export interface CapsNeedLinkingSide {
    side: EventSide
    label: string
    team: string
    color: SideColor | null
    expected: number
    linked: number
}

export interface CapsNeedLinkingRow {
    key: string
    item: EventCapReviewItem
    match: string
    round: string | null
    map: string
    sides: CapsNeedLinkingSide[]
    reason: string
    prefill: CapLinkPrefill
}

const REASON_COPY: Record<EventCapFlagReason, string> = {
    no_runs: 'No runs found on this map during the match',
    too_few_runs: 'Not enough runs found',
    mixed_servers: 'Runs on more than one server',
    same_second_decider: 'Both teams capped within 2 seconds',
    run_used_elsewhere: 'A run is already linked to another match',
    no_window: 'No pick & ban or scheduled time to search from',
}

function runNoun(count: number): string {
    return count === 1 ? 'run' : 'runs'
}

function teamOf(item: EventCapReviewItem, side: EventSide): string {
    return (side === 'a' ? item.team_a : item.team_b).name
}

function shortSideReason(item: EventCapReviewItem, colors: ReviewSideColors): string | null {
    const { detail } = item
    if (item.reason !== 'too_few_runs' || !detail) return null

    const color = colors[detail.side]
    const team = teamOf(item, detail.side)
    if (detail.found === 0) {
        return color
            ? `No ${sideColorName(color)} runs found, ${detail.expected} expected`
            : `No runs found for ${team}, ${detail.expected} expected`
    }
    return color
        ? `Only ${detail.found} of ${detail.expected} ${sideColorName(color)} ${runNoun(detail.expected)} found`
        : `Only ${detail.found} of ${detail.expected} ${runNoun(detail.expected)} found for ${team}`
}

export function reviewReason(item: EventCapReviewItem, colors: ReviewSideColors): string {
    return shortSideReason(item, colors) ?? REASON_COPY[item.reason]
}

const MINUTE_MS = 60_000

function upToWholeMinute(iso: string): string {
    const time = new Date(iso).getTime()
    return Number.isNaN(time) ? iso : new Date(Math.ceil(time / MINUTE_MS) * MINUTE_MS).toISOString()
}

export function reviewPrefill(item: EventCapReviewItem): CapLinkPrefill {
    return item.window ? { map: item.map, from: item.window.from, to: upToWholeMinute(item.window.to) } : {}
}

function sideColorsOf(item: EventCapReviewItem, redTeamId: string | null | undefined): ReviewSideColors {
    if (redTeamId === item.team_a.id) return { a: 'red', b: 'blue' }
    if (redTeamId === item.team_b.id) return { a: 'blue', b: 'red' }
    return { a: null, b: null }
}

export function capsNeedLinkingRows(
    items: EventCapReviewItem[],
    redTeamIds: Record<string, string | null | undefined>,
): CapsNeedLinkingRow[] {
    return items.map(item => {
        const colors = sideColorsOf(item, redTeamIds[item.match_id])
        return {
            key: `${item.match_id}:${item.ordinal}`,
            item,
            match: `${item.team_a.name} vs ${item.team_b.name}`,
            round: item.round_label,
            map: item.display_name,
            sides: (['a', 'b'] as const).map(side => ({
                side,
                label: colors[side] ? sideColorTitle(colors[side]) : SIDES_TBC,
                team: teamOf(item, side),
                color: colors[side],
                expected: item.expected[side],
                linked: item.linked[side],
            })),
            reason: reviewReason(item, colors),
            prefill: reviewPrefill(item),
        }
    })
}

export function linkReviewRuns(
    accessToken: string,
    slug: string,
    item: EventCapReviewItem,
    caps: Array<{ cap_id: string; side: EventSide }>,
): Promise<EventMatch> {
    return linkEventMatchMapCaps(accessToken, slug, item.match_id, item.ordinal, caps, true)
}
