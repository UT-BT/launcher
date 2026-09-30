import { parseApiInstant } from '@/app/utils/timezone'
import { relativeTimeText, utcTimeText } from '../sceneHelpers'
import type { StreamHotState, StreamUserRef } from '../data/streamHotState'
import { channelText, teamName, type FeedMatch, type StreamFeed } from '../ticker/streamFeed'

const NEXT_MATCH_LIMIT = 3

export interface EndingCredit {
    key: string
    userId: string | null
    name: string
}

export interface EndingMatch {
    key: string
    when: string
    relative: string
    teams: [string, string]
    where: string
    channel: string
    thisChannel: boolean
}

export interface EndingModel {
    kicker: string | null
    streamer: EndingCredit | null
    casters: EndingCredit[]
    next: EndingMatch[]
}

interface EndingInput {
    state: StreamHotState
    feed: StreamFeed | null
    now: number
}

function nameOf(user: StreamUserRef): string | null {
    const name = user.display_name?.trim()
    return name ? name : null
}

function streamerCredit(streamer: StreamHotState['streamer']): EndingCredit | null {
    const name = streamer.display_name?.trim() || channelText(streamer.channel)
    return name ? { key: 'streamer', userId: streamer.id, name } : null
}

function casterCredits(casters: StreamUserRef[]): EndingCredit[] {
    return casters.flatMap((caster, index) => {
        const name = nameOf(caster)
        return name ? [{ key: `caster-${index}`, userId: caster.id, name }] : []
    })
}

function kickerOf(match: StreamHotState['match']): string | null {
    if (!match || match.score.winner === null || !match.teams.a || !match.teams.b) return null
    return `${match.teams.a.name} ${match.score.series.a}–${match.score.series.b} ${match.teams.b.name}`
}

function candidates(feed: StreamFeed): FeedMatch[] {
    const listed = new Set(feed.upcoming.map(match => match.id))
    return feed.next_match && !listed.has(feed.next_match.id) ? [...feed.upcoming, feed.next_match] : feed.upcoming
}

function nextMatches({ state, feed, now }: EndingInput): EndingMatch[] {
    if (!feed) return []
    const own = channelText(state.streamer.channel)
    const ownNextId = feed.next_match?.id ?? null
    const rows = candidates(feed).flatMap(match => {
        const at = parseApiInstant(match.scheduled_at)
        const channel = channelText(match.stream_url)
        if (at === null || channel === null || at < now || match.id === state.match?.id) return []
        const thisChannel = match.id === ownNextId || (own !== null && channel === own)
        const row: EndingMatch = {
            key: match.id,
            when: utcTimeText(at, now),
            relative: relativeTimeText(at, now),
            teams: [teamName(match.teams.a), teamName(match.teams.b)],
            where: [match.stage.name, match.round.label].filter(Boolean).join(' · '),
            channel,
            thisChannel,
        }
        return [{ at, row }]
    })
    return rows
        .sort((left, right) => left.at - right.at)
        .slice(0, NEXT_MATCH_LIMIT)
        .map(entry => entry.row)
}

export function endingModel(input: EndingInput): EndingModel {
    const { state } = input
    return {
        kicker: kickerOf(state.match),
        streamer: streamerCredit(state.streamer),
        casters: casterCredits(state.match?.casters ?? []),
        next: nextMatches(input),
    }
}
