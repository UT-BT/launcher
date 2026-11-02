import type {
    EventAuditEntry,
    EventBracket,
    EventBracketStage,
    EventBracketTeamRef,
    EventDetail,
    EventLfpEntry,
    EventMatch,
    EventMatchAdmin,
    EventSchedulingConfig,
    EventStreamer,
    EventTeam,
    EventVolunteerRow,
    MyEventStatus,
    PickBanQueueEntry,
    PredictionAdminMarkets,
    ScheduleOversightEntry,
} from '../../../../app/utils/api'
import { ROLE } from '../../../../app/utils/roles'
import { pickBanVetoFixture } from '../../../../app/utils/fixtures/pickBanVetoFixtures'
import { bracketStage, groupStage, standingsFormat, swissStage } from '../../../../app/components/stream/scenes/standings/standingsFixtures'
import { ok, type FixtureRoute, type FixtureSet } from '../types'
import { FORMATS } from './admin'
import { daysAgo, hoursAgo, person, VIEWER } from './people'
import { sessionRoutes } from './session'

export const MANAGED_EVENT_SLUG = 'test-cup-manage'
export const MANAGED_EVENT_NAME = 'Test Cup 2026 Manager Edition'

const event: EventDetail = {
    id: 'synthetic-managed-event',
    slug: MANAGED_EVENT_SLUG,
    name: MANAGED_EVENT_NAME,
    summary: 'A synthetic tournament seen by its manager.',
    description: 'Synthetic description of the tournament for the mobile crawl.',
    rules: 'Synthetic rules: first to two caps per map.',
    team_size: 2,
    bracket_type: 'groups',
    status: 'active',
    signups_open: false,
    signup_opens_at: daysAgo(40),
    signup_closes_at: daysAgo(20),
    starts_at: daysAgo(10),
    ends_at: daysAgo(-20),
    max_teams: 16,
    team_count: 16,
    registered_team_count: 16,
    created_at: daysAgo(60),
    published_at: daysAgo(50),
    predictions_enabled: false,
    achievements_enabled: true,
}

const stages: EventBracketStage[] = [groupStage(), swissStage(), bracketStage()]

const bracket: EventBracket = {
    published: true,
    format: { template: { id: FORMATS[0].id, slug: FORMATS[0].slug, name: FORMATS[0].name, summary: FORMATS[0].summary }, spec: standingsFormat() },
    stages,
}

const matches: EventMatch[] = stages.flatMap(stage => stage.matches.map(match => ({ ...match, stage_id: stage.id })))

const teamRefs: EventBracketTeamRef[] = [...new Map(
    matches.flatMap(match => [match.team_a, match.team_b]).filter((team): team is EventBracketTeamRef => team !== null).map(team => [team.id, team]),
).values()]

const teams: EventTeam[] = teamRefs.map((team, index) => {
    const captain = person(index * 2 + 80)
    const mate = person(index * 2 + 81)
    return {
        id: team.id,
        tournament_id: event.id,
        name: team.name ?? `Team ${index + 1}`,
        captain: captain.id,
        status: index === teamRefs.length - 1 ? 'pending' : 'registered',
        division: index % 2 ? 'Open' : 'Advanced',
        seed: index + 1,
        member_count: 2,
        members: [captain, mate].map((member, slot) => ({
            user: member.id,
            alias: member.alias,
            flag: member.flag,
            role: slot === 0 ? 'captain' : 'member',
            status: 'active',
            joined_at: daysAgo(30 - index),
            invited_at: daysAgo(31 - index),
            timezone: 'Europe/Berlin',
            availability: 'Weekday evenings after 19:00',
        })),
        created_at: daysAgo(35 - index),
    }
})

const lfp: EventLfpEntry[] = Array.from({ length: 4 }, (_, index) => ({
    user: person(index + 110).id,
    alias: person(index + 110).alias,
    flag: person(index + 110).flag,
    timezone: 'America/New_York',
    availability: 'Weekends',
    note: 'Looking for a calm partner who knows the hard maps.',
    created_at: daysAgo(25 - index),
}))

const me: MyEventStatus = {
    team: null,
    invitations: [],
    lfp: null,
    volunteer: null,
    can_manage: true,
    can_manage_bracket: true,
    is_streamer: false,
    pick_ban_session: null,
}

const streamers: EventStreamer[] = Array.from({ length: 4 }, (_, index) => ({
    id: person(index + 40).id,
    display_name: person(index + 40).alias,
    twitch_url: index === 1 ? null : `https://twitch.tv/test_streamer_${index + 1}`,
}))

const matchAdmins: EventMatchAdmin[] = Array.from({ length: 4 }, (_, index) => ({
    id: person(index + 30).id,
    display_name: person(index + 30).alias,
    role: [ROLE.USER, ROLE.MODERATOR, ROLE.CUP_ADMIN, ROLE.ADMIN][index],
    event_manager: index === 0,
}))

const staffed: EventMatch[] = matches.map((match, index) => ({
    ...match,
    streamer: index % 3 === 0 ? streamers[index % streamers.length] : null,
    match_admin: index % 2 === 0 ? matchAdmins[index % matchAdmins.length] : null,
}))

const volunteers: EventVolunteerRow[] = Array.from({ length: 5 }, (_, index) => ({
    user: person(index + 120).id,
    alias: person(index + 120).alias,
    flag: person(index + 120).flag,
    created_at: daysAgo(22 - index),
    streaming: index % 2 === 0,
    casting: index % 3 === 0,
    admining: index % 2 === 1,
    note: index % 2 ? 'Available most evenings' : null,
}))

const audit: { items: EventAuditEntry[]; count: number } = {
    items: Array.from({ length: 15 }, (_, index) => ({
        id: `synthetic-event-audit-${index + 1}`,
        action: ['team.register', 'team.withdraw', 'match.schedule', 'match.report'][index % 4],
        team_id: teams[index % teams.length].id,
        match_id: matches[index % matches.length].id,
        actor: VIEWER.id,
        actor_alias: VIEWER.alias,
        target: teams[index % teams.length].captain,
        target_alias: teams[index % teams.length].members[0].alias,
        created_at: hoursAgo(index * 5),
    })),
    count: 128,
}

const queue: PickBanQueueEntry[] = matches.filter(match => match.team_a && match.team_b && match.status !== 'complete').map((match, index) => ({
    match_id: match.id,
    stage_key: stages.find(stage => stage.id === match.stage_id)?.key ?? 'groups',
    stage_name: stages.find(stage => stage.id === match.stage_id)?.name ?? 'Group Stage',
    round_no: match.round_no,
    round_label: match.round_label,
    scheduled_at: match.scheduled_at,
    teams: {
        team_a: match.team_a ? { id: match.team_a.id, name: match.team_a.name ?? '' } : null,
        team_b: match.team_b ? { id: match.team_b.id, name: match.team_b.name ?? '' } : null,
    },
    session_status: index === 0 ? 'running' : index === 1 ? 'lobby' : 'none',
    ready_count: index === 1 ? 1 : 0,
    online_count: index < 2 ? 2 : 0,
    startable: index === 1,
    blocking_reason: null,
    streamer: streamers[index % streamers.length],
}))

const scheduling: EventSchedulingConfig = {
    tournament: { starts_at: event.starts_at, ends_at: event.ends_at },
    stages: stages.map((stage, index) => ({
        id: stage.id,
        key: stage.key,
        name: stage.name,
        kind: stage.kind,
        window_opens_at: daysAgo(10 - index * 7),
        window_closes_at: daysAgo(3 - index * 7),
        default_round_duration_days: 3,
        expected_match_duration_minutes: 60,
        effective_match_duration_minutes: 60,
        rounds: Array.from({ length: 3 }, (_, round) => ({
            round_no: round + 1,
            opens_at: daysAgo(10 - index * 7 - round * 2),
            closes_at: daysAgo(8 - index * 7 - round * 2),
        })),
    })),
}

const oversight: ScheduleOversightEntry[] = matches.filter(match => match.status !== 'complete' && match.team_a && match.team_b).slice(0, 6).map((match, index) => ({
    tournament: { id: event.id, slug: event.slug, name: event.name },
    match,
    slot_window: { opens_at: daysAgo(4), closes_at: daysAgo(-2) },
    schedulable: true,
    reason: null,
    whose_turn: index % 2 ? match.team_a?.id ?? null : match.team_b?.id ?? null,
    proposal: null,
    overdue: index % 3 === 0,
    stalled_since: index % 3 === 0 ? daysAgo(2) : null,
}))

const predictionMarkets: PredictionAdminMarkets = {
    items: [],
    bracket_published: true,
    config: { enabled: false },
}

const base = `/tournaments/${MANAGED_EVENT_SLUG}`

export const EVENT_MANAGER_SET: FixtureSet = {
    name: 'event-manager',
    routes: [
        ...sessionRoutes(ROLE.USER),
        { host: 'api', path: base, reply: ok({ tournament: event }) },
        { host: 'api', path: `${base}/me`, reply: ok(me) },
        { host: 'api', path: `${base}/teams`, reply: ok({ items: teams }) },
        { host: 'api', path: `${base}/admin/teams`, reply: ok({ items: teams }) },
        { host: 'api', path: `${base}/lfp`, reply: ok({ items: lfp }) },
        { host: 'api', path: `${base}/bracket`, reply: ok({ ...bracket, stages: stages.map(stage => ({ ...stage, matches: staffed.filter(match => match.stage_id === stage.id) })) }) },
        { host: 'api', path: `${base}/pick-ban/config`, reply: ok(pickBanVetoFixture('pickBanConfig')) },
        { host: 'api', path: `${base}/admin/pick-ban/config`, reply: ok(pickBanVetoFixture('pickBanConfig')) },
        { host: 'api', path: `${base}/admin/pick-ban/queue`, reply: ok({ matches: queue }) },
        { host: 'api', path: `${base}/admin/volunteers`, reply: ok({ items: volunteers }) },
        { host: 'api', path: `${base}/admin/audit`, reply: ok(audit) },
        { host: 'api', path: `${base}/admin/streamers`, reply: ok({ items: streamers }) },
        { host: 'api', path: `${base}/admin/match-admins`, reply: ok({ items: matchAdmins }) },
        { host: 'api', path: `${base}/admin/caps/review`, reply: ok({ items: [] }) },
        { host: 'api', path: `${base}/admin/scheduling`, reply: ok(scheduling) },
        { host: 'api', path: `${base}/admin/schedule`, reply: ok({ items: oversight }) },
        { host: 'api', path: `${base}/predictions/admin/markets`, reply: ok(predictionMarkets) },
        { host: 'api', path: `${base}/predictions/admin/ledger`, reply: ok({ total: 0, items: [] }) },
        { host: 'api', path: new RegExp(`^${base}/matches/[^/]+$`), reply: url => ok({ match: staffed.find(match => url.pathname.endsWith(`/${match.id}`)) ?? staffed[0] }) },
        { host: 'api', path: '/tournaments/formats', reply: ok({ items: FORMATS }) },
    ] satisfies FixtureRoute[],
}
