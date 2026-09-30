import type { RawActiveTitle } from '@/app/utils/api'
import type { PickBanTone } from '@/app/components/broadcast/broadcastTone'
import { displayMapName, formatDelta } from '@/app/utils/format'
import { mapVideoUrl } from '@/app/utils/mapScreenshots'
import type { StreamLineupSlot, StreamMatch, StreamSide, StreamUserRef } from '../../data/streamHotState'
import { mapNumber } from '../../sceneHelpers'
import { teamLabel } from '../intermission/intermissionView'
import type { NextMapDetails, NextMapRead } from './nextMapRead'

export interface NextMapPerson {
    id: string | null
    name: string | null
}

export interface NextMapPlayerView {
    slot: StreamLineupSlot
    side: StreamSide
    id: string | null
    name: string | null
    title: RawActiveTitle | null
    pb: { seconds: number; verified: boolean } | null
    gap: string | null
}

export interface NextMapWrView {
    seconds: number
    holders: NextMapPerson[][]
}

export interface NextMapHistoryView {
    timesPlayed: number
    played: string
    fastest: { seconds: number; verified: boolean; team: string | null; players: NextMapPerson[] } | null
}

export type NextMapMedia =
    | { kind: 'pending' }
    | { kind: 'video'; src: string; playing: boolean }
    | { kind: 'screenshot'; map: string; version: string | null; pan: boolean }

export interface NextMapShown {
    ordinal: number
    number: number
    map: string
    title: string
    decider: boolean
    pick: string | null
    tone: PickBanTone
    mapper: string | null
    wr: NextMapWrView | null
    players: NextMapPlayerView[]
    history: NextMapHistoryView | null
    media: NextMapMedia
    loaded: boolean
}

export type NextMapView =
    | { state: 'map'; kicker: string; next: NextMapShown }
    | { state: 'tbd'; kicker: string; number: number }
    | { state: 'over'; kicker: string }

export interface NextMapInput {
    match: StreamMatch
    read: NextMapRead | null
    readFailed: boolean
    failedVideo: string | null
    animate: boolean
}

export interface NextMapMediaInput {
    map: string
    details: NextMapDetails | null
    settled: boolean
    failedVideo: string | null
    animate: boolean
}

const SLOTS: StreamLineupSlot[] = ['a1', 'a2', 'b1', 'b2']

function sideOfSlot(slot: StreamLineupSlot): StreamSide {
    return slot.startsWith('a') ? 'a' : 'b'
}

function personOf(user: StreamUserRef): NextMapPerson {
    return { id: user.id, name: user.display_name }
}

function titleOf(match: StreamMatch, side: StreamSide, id: string | null): RawActiveTitle | null {
    return match.teams[side]?.members.find(member => member.id === id)?.title ?? null
}

export function nextMapGap(pb: number | null, wr: number | null): string | null {
    if (pb === null || wr === null) return null
    const gap = Math.round((pb - wr) * 1000) / 1000
    if (gap === 0) return 'WR'
    return gap > 0 ? `+${formatDelta(gap)}` : `-${formatDelta(-gap)}`
}

export function nextMapMedia({ map, details, settled, failedVideo, animate }: NextMapMediaInput): NextMapMedia {
    if (!details && !settled) return { kind: 'pending' }
    if (details?.video.available) {
        const src = mapVideoUrl(details.name, details.video.version)
        if (src !== failedVideo) return { kind: 'video', src, playing: animate }
    }
    return { kind: 'screenshot', map, version: details?.screenshot_version ?? null, pan: animate }
}

function playersOf(match: StreamMatch, read: NextMapRead | null): NextMapPlayerView[] {
    const wr = read?.team_wr?.time_seconds ?? null
    return SLOTS.flatMap<NextMapPlayerView>(slot => {
        const side = sideOfSlot(slot)
        const user = read ? read.lineup[slot] : match.lineup[slot]
        if (!user) return []
        const pbTime = read?.lineup[slot]?.pb ?? null
        const pb = pbTime ? { seconds: pbTime.time_seconds, verified: pbTime.verified } : null
        return [{ slot, side, id: user.id, name: user.display_name, title: titleOf(match, side, user.id), pb, gap: nextMapGap(pb?.seconds ?? null, wr) }]
    })
}

function playedText(times: number): string {
    if (times === 0) return 'Not played yet in this cup'
    return times === 1 ? 'Played once in this cup' : `Played ${times} times in this cup`
}

function historyOf(read: NextMapRead): NextMapHistoryView | null {
    const history = read.cup_history
    if (!history) return null
    const run = history.fastest_run
    return {
        timesPlayed: history.times_played,
        played: playedText(history.times_played),
        fastest: run ? { seconds: run.time_seconds, verified: run.verified, team: run.team?.name ?? null, players: run.players.map(personOf) } : null,
    }
}

export function nextMapReadOrdinal(match: StreamMatch): number | null {
    const ordinal = match.score.current_map
    if (ordinal === null) return null
    return match.maps.some(map => map.ordinal === ordinal && map.map) ? ordinal : null
}

export function nextMapView({ match, read, readFailed, failedVideo, animate }: NextMapInput): NextMapView {
    const ordinal = match.score.current_map
    if (ordinal === null) return { state: 'over', kicker: `Series ${match.score.series.a}–${match.score.series.b} · final` }
    const number = mapNumber(ordinal)
    const kicker = `Map ${number} of ${match.best_of}`
    const row = match.maps.find(map => map.ordinal === ordinal)
    if (!row?.map) return { state: 'tbd', kicker, number }

    const forSlot = read && read.match_id === match.id && read.ordinal === ordinal ? read : null
    const fresh = forSlot?.map?.name === row.map ? forSlot : null
    const decider = row.kind === 'decider'
    const pickedBy = decider ? null : row.picked_by
    const next: NextMapShown = {
        ordinal,
        number,
        map: row.map,
        title: displayMapName(row.map),
        decider,
        pick: pickedBy ? `Picked by ${teamLabel(match, pickedBy)}` : decider ? 'Decider' : null,
        tone: pickedBy ?? (decider ? 'gold' : 'neutral'),
        mapper: fresh?.map?.mapper ?? null,
        wr: fresh?.team_wr ? { seconds: fresh.team_wr.time_seconds, holders: fresh.team_wr.holders.map(roster => roster.map(personOf)) } : null,
        players: playersOf(match, fresh),
        history: fresh ? historyOf(fresh) : null,
        media: nextMapMedia({ map: row.map, details: fresh?.map ?? null, settled: forSlot !== null || readFailed, failedVideo, animate }),
        loaded: fresh !== null,
    }
    return { state: 'map', kicker, next }
}
