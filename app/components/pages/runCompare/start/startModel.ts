import type { ActiveTitle, Map as MapRow, Record as WorldRecord } from '@/app/utils/api'
import { EMPTY_COMPARE_STATE, serializeCompareQuery } from '../url/compareUrl'

export const MIN_SEARCH_LENGTH = 2
export const SEARCH_LIMIT = 8
export const RECORD_PICKS = 96
export const RECORDS_SHOWN = 12
export const RECORDS_FETCHED = 120
export const SHOWN_HOLDERS = 2

export interface MapPick {
    name: string
    team: string | null
    version: string | null
}

export interface Holder {
    user: string
    alias: string | null
    title: ActiveTitle | null
}

export interface RecordPick {
    map: string
    seconds: number
    team: string | null
    holders: Holder[]
    more: number
}

export function teamSizeLabel(players: number | null | undefined): string | null {
    return players && players > 1 ? `${players}-player` : null
}

export function searchTermOf(raw: string): string | null {
    const term = raw.trim()
    return term.length >= MIN_SEARCH_LENGTH ? term : null
}

export function mapQuery(map: string): string {
    return serializeCompareQuery({ ...EMPTY_COMPARE_STATE, map })
}

export function pickedQuery(picked: readonly string[]): string {
    return serializeCompareQuery({ ...EMPTY_COMPARE_STATE, runs: [...picked] })
}

export function togglePick(picked: readonly string[], capId: string, limit: number): string[] {
    if (picked.includes(capId)) return picked.filter(id => id !== capId)
    return picked.length < limit ? [...picked, capId] : [...picked]
}

export function addPicks(picked: readonly string[], capIds: readonly string[], limit: number): string[] {
    const next = [...picked]
    for (const capId of capIds) {
        if (next.length >= limit) break
        if (!next.includes(capId)) next.push(capId)
    }
    return next
}

export function mapPicks(rows: readonly MapRow[]): MapPick[] {
    const seen = new Set<string>()
    return rows.flatMap(row => {
        if (seen.has(row.name)) return []
        seen.add(row.name)
        return [{ name: row.name, team: teamSizeLabel(row.required_players), version: row.screenshot_updated ?? null }]
    })
}

function holdersOf(record: WorldRecord): Holder[] {
    if (record.members && record.members.length > 0) {
        return record.members.map(member => ({ user: member.user, alias: member.alias, title: member.active_title }))
    }
    return [{ user: record.user_id, alias: record.alias, title: record.active_title ?? null }]
}

export function recordPicks(records: readonly WorldRecord[], limit = RECORD_PICKS): RecordPick[] {
    const picks: RecordPick[] = []
    for (const record of records) {
        if (picks.length >= limit) break
        if (picks.some(pick => pick.map === record.map)) continue
        const holders = holdersOf(record)
        picks.push({
            map: record.map,
            seconds: record.cap_time_seconds,
            team: teamSizeLabel(record.members?.length),
            holders: holders.slice(0, SHOWN_HOLDERS),
            more: Math.max(0, holders.length - SHOWN_HOLDERS),
        })
    }
    return picks
}
