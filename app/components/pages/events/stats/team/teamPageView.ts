import { ACCENT_SLOT_COUNT, accentSlots, teamPageTeams, type AccentTeam } from '@/app/components/pages/events/stats/statsView'
import type {
    EventStatsTeam, EventTeamMapProfileRow, EventTeamStats, EventTeamStatsMatch, EventTeamStatsPickBan, PickBanStepAction,
} from '@/app/utils/api'

export function teamPageAccentSlots(eventTeams: readonly AccentTeam[] | null, stats: EventTeamStats): Record<string, number> {
    const teams = [...(eventTeams ?? [])]
    for (const team of teamPageTeams(stats)) {
        if (!teams.some(known => known.id === team.id)) teams.push(team)
    }
    return accentSlots(teams)
}

export function backdropMapName(rows: readonly EventTeamMapProfileRow[]): string | null {
    let best: EventTeamMapProfileRow | null = null
    for (const row of rows) {
        if (row.played > 0 && (!best || row.played > best.played)) best = row
    }
    return best?.map ?? null
}

function hasResult(match: Pick<EventTeamStatsMatch, 'status'>): boolean {
    return match.status === 'complete' || match.status === 'forfeit'
}

export type MatchToggles = Record<string, boolean>

export function expandedMatchIds(matches: readonly EventTeamStatsMatch[], toggles: MatchToggles): Set<string> {
    const decided = matches.filter(hasResult)
    const latest = decided.filter(match => match.status === 'complete').at(-1)?.id
    return new Set(decided.filter(match => toggles[match.id] ?? match.id === latest).map(match => match.id))
}

export function emptyStageStats(team: EventStatsTeam): EventTeamStats {
    const none = { w: 0, d: 0, l: 0 }
    return {
        team: {
            ...team,
            record: { matches: none, maps: none, caps: { for: 0, against: 0 } },
            form: [],
            pace: null,
            comebacks: 0,
        },
        pace_rank: null,
        matches: [],
        map_profile: [],
        runs: [],
    }
}

const STEP_ACTION_LABELS: Record<PickBanStepAction, string> = { ban: 'Ban', pick: 'Pick', decider: 'Decider' }

export interface PickBanStepView {
    key: number
    number: number
    action: PickBanStepAction
    actionLabel: string
    teamId: string | null
    teamName: string | null
    actor: { id: string; name: string } | null
    displayName: string
}

export function pickBanStepViews(pickBan: EventTeamStatsPickBan, names: Record<string, string>): PickBanStepView[] {
    return pickBan.steps.map((step, position) => ({
        key: step.index,
        number: position + 1,
        action: step.action,
        actionLabel: STEP_ACTION_LABELS[step.action],
        teamId: step.team_id,
        teamName: step.team_id ? names[step.team_id] ?? null : null,
        actor: step.acted_by ? { id: step.acted_by.id, name: step.acted_by.display_name } : null,
        displayName: step.display_name,
    }))
}

export function teamAccentColor(slot: number | undefined): string {
    const wrapped = ((slot ?? ACCENT_SLOT_COUNT - 1) % ACCENT_SLOT_COUNT + ACCENT_SLOT_COUNT) % ACCENT_SLOT_COUNT
    return `var(--team-accent-${wrapped})`
}
