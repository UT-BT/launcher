import type { ActiveTitle, Record as WorldRecord } from '@/app/utils/api'
import { formatCapTime } from '@/app/utils/format'
import type { WRHolder, WRHolderMember } from '@/app/components/pages/MapsPage.types'

/**
 * One player line of the holder block.
 */
export interface WRHolderLine {
    /**
     * Player id, or an empty string when the record has none.
     */
    userId: string
    /**
     * Alias of the player.
     */
    alias: string
    /**
     * Active title of the player, or `null` when the player shows none.
     */
    title: ActiveTitle | null
    /**
     * Split time of a team member, formatted with `formatCapTime`. `null` on a solo line.
     */
    split: string | null
}

/**
 * Returns the holder of a world record, as the Maps holder cache stores it.
 *
 * Team records carry their players in `members`, kept in API order. A team record sends a
 * `null` top-level `user_id`, which becomes an empty string.
 */
export const toWRHolder = (record: WorldRecord): WRHolder => {
    const holder: WRHolder = {
        user_id: record.user_id ?? '',
        alias: record.alias,
        cap_id: record.cap_id,
        color_r: record.color_r,
        color_g: record.color_g,
        color_b: record.color_b,
        title: record.active_title ?? null,
    }
    if (record.members && record.members.length > 0) {
        holder.members = record.members.map(member => ({
            user_id: member.user,
            alias: member.alias,
            title: member.active_title ?? null,
            cap_time_seconds: member.cap_time_seconds,
        }))
    }
    return holder
}

/**
 * Returns a copy of the members, sorted by split time, fastest first. Members with the same
 * split keep their order.
 */
export const sortMembersBySplit = (members: readonly WRHolderMember[]): WRHolderMember[] =>
    [...members].sort((a, b) => a.cap_time_seconds - b.cap_time_seconds)

/**
 * Returns the player lines that the holder block shows for a holder.
 *
 * A solo holder gives one line without a split. A team holder gives one line per member,
 * fastest first. A team holder without members gives `null`, so the block shows nothing,
 * and the joined top-level alias never shows.
 */
export const wrHolderLines = (holder: WRHolder, isTeam: boolean): WRHolderLine[] | null => {
    if (!isTeam) {
        return [{ userId: holder.user_id, alias: holder.alias, title: holder.title ?? null, split: null }]
    }
    if (!holder.members || holder.members.length === 0) return null
    return sortMembersBySplit(holder.members).map(member => ({
        userId: member.user_id,
        alias: member.alias,
        title: member.title,
        split: formatCapTime(member.cap_time_seconds),
    }))
}
