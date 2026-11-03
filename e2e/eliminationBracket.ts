import type { Page } from '@playwright/test'
import { readRecording } from './mobile/fixtures/recording'
import { EVENT_SLUG } from './mobile/manifest/event-detail'

export const ELIM_ROUNDS = ['Round of 16', 'Quarterfinals', 'Semifinals', 'Final'] as const
export const ELIM_PATH = `/events/${EVENT_SLUG}?tab=bracket`

const BRACKET_PATH = `/tournaments/${EVENT_SLUG}/bracket`

interface RecordedBracket {
    stages: { id: string; matches: Record<string, unknown>[] }[]
}

function recordedBracket(): RecordedBracket {
    const recorded = readRecording('event-detail').responses.find(response => response.path === BRACKET_PATH)
    if (!recorded) throw new Error(`the event-detail recording has no ${BRACKET_PATH}`)
    return (recorded.body as { data: RecordedBracket }).data
}

export const ELIM_FIRST_TEAM = String((recordedBracket().stages[0].matches[0].team_a as { name: string }).name)

function eliminationBracket(): RecordedBracket {
    const bracket = recordedBracket()
    const source = bracket.stages[0]
    const stageId = `${source.id}-elimination`
    let next = 0
    const matches = ELIM_ROUNDS.flatMap((label, index) => {
        const count = 2 ** (ELIM_ROUNDS.length - 1 - index)
        return Array.from({ length: count }, (_, ordinal) => ({
            ...source.matches[next++],
            stage_id: stageId,
            group_id: null,
            round_no: index + 1,
            round_label: label,
            ordinal,
            winner_to_match_id: null,
            winner_to_slot: null,
        }))
    })
    const stage = {
        ...source,
        id: stageId,
        key: 'playoffs',
        name: 'Playoffs',
        kind: 'single_elim',
        ordinal: 0,
        status: 'complete',
        config: null,
        groups: [],
        matches,
    }
    return { ...bracket, stages: [stage] }
}

export async function serveEliminationBracket(page: Page) {
    const data = eliminationBracket()
    await page.route(url => url.pathname.replace(/\/$/, '') === BRACKET_PATH, route =>
        route.fulfill({ json: { success: true, data } }).catch(() => undefined))
}
