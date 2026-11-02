import type {
    AcCapDeltaRow,
    AcLowFpsWrRow,
    AcSharedGroup,
    AdminActiveTitle,
    AdminCapRow,
    AdminHostsResponse,
    AdminMapRow,
    AdminOverview,
    AdminPatch,
    AdminRoleRow,
    AdminTitleSummary,
    AdminUsage,
    AdminUsageRecent,
    AdminUserDetail,
    AdminUserRow,
    AuditEntry,
    DifficultySyncChange,
    EventDetail,
    EventFormatTemplate,
    EventManager,
    MapvoteStatus,
    RosterStreamer,
    RosterSuggestion,
    TitleHolder,
} from '../../../../app/utils/api'
import { ROLE } from '../../../../app/utils/roles'
import { MAP_UPLOAD_FIXTURES } from '../../../../app/utils/fixtures/mapUploadFixtures'
import { ok, type FixtureReply, type FixtureRoute, type FixtureSet } from '../types'
import { daysAgo, documentationIp, fakeBtpog, fakeHwid, hoursAgo, person, syntheticId, syntheticMap, TITLE, VIEWER } from './people'
import { sessionRoutes } from './session'

const PAGE = 50

const ACTIVE_TITLE: AdminActiveTitle = TITLE

function pageOf<T>(url: URL, build: (index: number) => T, total: number): T[] {
    const limit = Number(url.searchParams.get('limit') ?? PAGE) || PAGE
    const offset = Number(url.searchParams.get('offset') ?? 0) || 0
    return Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, index) => build(offset + index))
}

function paged<T>(path: string, build: (index: number) => T, total: number): FixtureRoute[] {
    return [
        { host: 'api', path: `${path}/count`, reply: ok({ count: total }) },
        { host: 'api', path, reply: (url: URL): FixtureReply => ok({ items: pageOf(url, build, total) }) },
    ]
}

function items<T>(path: string, rows: T[]): FixtureRoute {
    return { host: 'api', path, reply: ok({ items: rows }) }
}

const overview: AdminOverview = {
    stats: {
        active_bans: 37,
        warns_24h: 4,
        staff_actions_24h: 61,
        total_users: 4812,
        total_caps: 51234,
        disallowed_caps: 389,
        total_maps: 612,
        active_maps: 544,
        inactive_maps: 68,
        total_titles: 40,
    },
}

function dayKey(daysBack: number): string {
    return daysAgo(daysBack).slice(0, 10)
}

function activity(url: URL) {
    const start = url.searchParams.get('start') ?? dayKey(29)
    const end = url.searchParams.get('end') ?? dayKey(0)
    const days = Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1)
    const points = Array.from({ length: days }, (_, index) => {
        const wave = Math.round(40 + 25 * Math.sin(index / 3))
        return {
            t: new Date(Date.parse(start) + index * 86_400_000).toISOString(),
            partial: index === days - 1,
            caps: wave * 6,
            players: wave * 2,
            playtime_hours: wave * 3,
            new_maps: index % 9 === 0 ? 2 : 0,
            new_users: (index * 7) % 11,
            achievements: wave,
            web_sessions: wave * 4,
            desktop_sessions: wave * 5,
        }
    })
    return ok({
        window: 'custom',
        bucket: 'day',
        start: `${start}T00:00:00+00:00`,
        end: `${end}T23:59:59+00:00`,
        requested_start: start,
        requested_end: end,
        partial_from: points[points.length - 1].t,
        day_resolution_series: [],
        unavailable_series: [],
        points,
    })
}

const TRACKED_PAGES = ['/', '/maps', '/players', '/world-records', '/events', '/caps/:id', '/maps/:name', '/players/:id']

function usage(url: URL): FixtureReply {
    const window = (url.searchParams.get('window') ?? '1w') as AdminUsage['window']
    const buckets = window === '24h' ? 24 : window === '1y' ? 12 : window === '1m' ? 30 : 7
    const count = (keys: string[], base: number) => keys.map((key, index) => ({ key, count: Math.max(1, base - index * 37) }))
    const body: AdminUsage = {
        window,
        bucket: window === '24h' ? 'hour' : window === '1y' ? 'month' : 'day',
        summary: {
            active_now: { web: 23, desktop: 41 },
            sessions: 9214,
            visitor_metric: { label: 'Visitors', value: 3120 },
            user_metric: { label: 'Signed-in users', value: 1288 },
            page_views: 48211,
            engaged_hours: 1934,
            avg_session_seconds: 731,
            error_sessions: 52,
            authenticated_sessions: 6110,
            anonymous_sessions: 3104,
        },
        points: Array.from({ length: buckets }, (_, index) => ({
            t: daysAgo(buckets - index),
            web_sessions: 300 + index * 11,
            desktop_sessions: 420 + index * 7,
            web_visitors: 210 + index * 5,
            desktop_visitors: 300 + index * 3,
            signed_in_users: 180 + index * 4,
            page_views: 2100 + index * 40,
            error_sessions: index % 4,
        })),
        breakdowns: {
            pages: count(TRACKED_PAGES, 9000),
            outcomes: count(['ok', 'error', 'aborted'], 8800),
            errors: count(['ChunkLoadError', 'NetworkError', 'TypeError'], 40),
            versions: count(['2.14.0', '2.13.2', '2.13.1', '2.12.0'], 3100),
            operating_systems: count(['Windows', 'Android', 'iOS', 'macOS', 'Linux'], 5200),
            browsers: count(['Chrome', 'Safari', 'Firefox', 'Edge', 'Samsung Internet'], 4100),
            viewports: count(['phone', 'tablet', 'laptop', 'desktop', 'wide'], 3900),
            referrers: count(['direct', 'discord.com', 'google.com', 'twitch.tv'], 6100),
        },
    }
    return ok(body)
}

const usageRecent: AdminUsageRecent = {
    items: Array.from({ length: 20 }, (_, index) => {
        const someone = person(index)
        return {
            user_id: someone.id,
            alias: someone.alias,
            active_title: TITLE,
            surface: index % 3 === 0 ? 'web' : 'desktop',
            active: index < 6,
            client_version: '2.14.0',
            os_family: index % 3 === 0 ? 'Android' : 'Windows',
            browser_family: index % 3 === 0 ? 'Chrome' : 'Electron',
            viewport_class: index % 3 === 0 ? 'phone' : 'desktop',
            last_view: TRACKED_PAGES[index % TRACKED_PAGES.length],
            started_at: hoursAgo(index + 1),
            last_seen_at: hoursAgo(index * 0.25),
            visible_seconds: 600 + index * 97,
            page_views: 4 + index,
        }
    }),
}

function userRow(index: number): AdminUserRow {
    const someone = person(index)
    const banned = index % 9 === 4
    return {
        id: someone.id,
        alias: someone.alias,
        utbt_role: index === 0 ? ROLE.ADMIN : index % 17 === 3 ? ROLE.MODERATOR : index % 23 === 5 ? ROLE.CUP_ADMIN : ROLE.USER,
        registered_at: daysAgo(30 + index * 11),
        active_title: ACTIVE_TITLE,
        banned,
        ban_reason: banned ? 'Repeated griefing on public servers' : null,
        ban_expires: banned ? daysAgo(-7) : null,
        warn_count: index % 4,
        ban_count: banned ? 1 + (index % 3) : 0,
    }
}

function userDetail(id: string): AdminUserDetail {
    const index = Math.max(0, Number(id.slice(-8)) - 1)
    const row = userRow(index)
    return {
        id: row.id,
        alias: row.alias,
        utbt_role: row.utbt_role,
        registered_at: row.registered_at,
        flag: person(index).flag,
        twitch_url: 'https://twitch.tv/example',
        cap_count: 412,
        active_bans: row.banned ? [{ id: 'ban-1', reason: 'Repeated griefing on public servers', start: daysAgo(3), end: daysAgo(-7) }] : [],
        warns: Array.from({ length: row.warn_count }, (_, warn) => ({ id: `warn-${warn}`, reason: 'Spawn blocking', warned_at: daysAgo(20 + warn) })),
        titles: [{ title_id: TITLE.id, name: TITLE.name, rarity: TITLE.rarity, color: TITLE.color, color_r: TITLE.color_r, color_g: TITLE.color_g, color_b: TITLE.color_b, selected: true }],
        ip_history: Array.from({ length: 4 }, (_, ip) => ({ value: documentationIp(index * 4 + ip), count: 40 - ip * 9, last_seen: daysAgo(ip) })),
        hwid_history: Array.from({ length: 2 }, (_, hwid) => ({ value: fakeHwid(index * 2 + hwid), count: 60 - hwid * 20, last_seen: daysAgo(hwid) })),
    }
}

const titles: AdminTitleSummary[] = Array.from({ length: 40 }, (_, index) => ({
    id: `synthetic-title-${index + 1}`,
    name: index === 0 ? TITLE.name : `Test Title ${index + 1}`,
    rarity: (index % 5) + 1,
    color: `${(index * 37) % 255},${(index * 91) % 255},${(index * 53) % 255}`,
    color_r: (index * 37) % 255,
    color_g: (index * 91) % 255,
    color_b: (index * 53) % 255,
    holders: (index * 13) % 70,
}))

const titleHolders: TitleHolder[] = Array.from({ length: 12 }, (_, index) => ({ id: person(index).id, alias: person(index).alias }))

const NEWS_CATEGORIES = [
    { key: 'update', label: 'Update', icon: 'sparkles', color: [94, 234, 212] },
    { key: 'event', label: 'Event', icon: 'trophy', color: [251, 191, 36] },
    { key: 'maps', label: 'Maps', icon: 'map', color: [129, 140, 248] },
    { key: 'community', label: 'Community', icon: 'users', color: [244, 114, 182] },
    { key: 'maintenance', label: 'Maintenance', icon: 'wrench', color: [248, 113, 113] },
]

const newsCategories = NEWS_CATEGORIES.map((category, index) => ({
    id: index + 1,
    key: category.key,
    label: category.label,
    color_r: category.color[0],
    color_g: category.color[1],
    color_b: category.color[2],
    icon: category.icon,
    sort_order: index,
    in_use: 3 - (index % 3),
}))

const news = Array.from({ length: 14 }, (_, index) => ({
    id: 900 + index,
    category: NEWS_CATEGORIES[index % NEWS_CATEGORIES.length].key,
    title: `Test announcement ${index + 1}: new maps and fixes this week`,
    excerpt: 'A short synthetic summary of what changed for players this week.',
    body: 'Synthetic body text for the news editor. It has a few sentences so the preview wraps on a phone.',
    link_url: 'https://example.com/notes',
    link_text: 'Read the notes',
    pinned: index === 0,
    published_at: daysAgo(index * 3),
    expires_at: index % 4 === 0 ? daysAgo(-14) : null,
    author_alias: VIEWER.alias,
    active: index % 5 !== 4,
    author_id: VIEWER.id,
    created_at: daysAgo(index * 3 + 1),
    updated_at: daysAgo(index * 3),
}))

const EVENT_STATUSES: EventDetail['status'][] = ['active', 'signups_open', 'announced', 'draft', 'completed', 'archived']

const events: EventDetail[] = EVENT_STATUSES.map((status, index) => ({
    id: `synthetic-event-${index + 1}`,
    slug: `test-cup-${index + 1}`,
    name: `Test Cup ${2026 - Math.floor(index / 2)} ${index % 2 ? 'Spring' : 'Autumn'} Edition`,
    summary: 'A synthetic tournament for the mobile crawl.',
    team_size: 2 + (index % 2),
    bracket_type: index % 2 ? 'double_elim' : 'groups',
    status,
    signups_open: status === 'signups_open',
    signup_opens_at: daysAgo(40 - index),
    signup_closes_at: daysAgo(20 - index),
    starts_at: daysAgo(10 - index * 5),
    ends_at: daysAgo(-20 + index * 5),
    max_teams: 16,
    team_count: 12 - index,
    registered_team_count: 10 - index,
    created_at: daysAgo(60 + index),
    published_at: status === 'draft' ? null : daysAgo(50 + index),
    description: 'Synthetic description.',
    rules: 'Synthetic rules.',
    predictions_enabled: index % 2 === 0,
    achievements_enabled: true,
}))

const eventManagers: EventManager[] = Array.from({ length: 3 }, (_, index) => ({
    user: person(index + 30).id,
    alias: person(index + 30).alias,
    flag: person(index + 30).flag,
    granted_by: VIEWER.id,
    granted_by_alias: VIEWER.alias,
    created_at: daysAgo(30 - index),
}))

export const FORMATS: EventFormatTemplate[] = ['Groups then double elimination', 'Single elimination', 'Swiss into playoffs', 'Round robin league'].map((name, index) => ({
    id: `synthetic-format-${index + 1}`,
    slug: `test-format-${index + 1}`,
    name,
    summary: `Synthetic template: ${name.toLowerCase()}.`,
    is_public: index !== 3,
    created_by: VIEWER.id,
    created_at: daysAgo(120 - index * 10),
    updated_at: daysAgo(10 - index),
}))

const roster: RosterStreamer[] = Array.from({ length: 8 }, (_, index) => ({
    user_id: person(index + 40).id,
    display_name: person(index + 40).alias,
    avatar: '',
    twitch_url: index % 3 === 1 ? null : `https://twitch.tv/test_streamer_${index + 1}`,
    added_by: { id: VIEWER.id, display_name: VIEWER.alias },
    added_at: daysAgo(40 - index),
    note: index % 2 ? 'Weekend evenings only' : null,
    upcoming_assignments: Array.from({ length: index % 3 }, (_, assignment) => ({
        match_id: `synthetic-match-${index}-${assignment}`,
        event: { slug: events[0].slug, name: events[0].name },
        label: `${person(assignment).alias} & ${person(assignment + 1).alias} vs ${person(assignment + 2).alias} & ${person(assignment + 3).alias}`,
        scheduled_at: assignment ? null : daysAgo(-2 - index),
    })),
}))

const suggestions: RosterSuggestion[] = Array.from({ length: 3 }, (_, index) => ({
    user_id: person(index + 60).id,
    display_name: person(index + 60).alias,
    avatar: '',
    twitch_url: `https://twitch.tv/test_suggestion_${index + 1}`,
    event: { slug: events[1].slug, name: events[1].name },
    signed_up_at: daysAgo(index + 1),
}))

function capRow(index: number): AdminCapRow {
    const someone = person(index)
    return {
        id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        user: someone.id,
        alias: someone.alias,
        active_title: ACTIVE_TITLE,
        map: syntheticMap(index),
        cap_time_seconds: 41.37 + index * 1.91,
        verified: index % 3 === 0,
        disallowed: index % 11 === 7,
        has_demo: index % 2 === 0,
        added: hoursAgo(index * 3),
        ip: documentationIp(index),
        hwid: fakeHwid(index),
        btpog_id: fakeBtpog(index),
    }
}

const MAP_TAGS = ['easy', 'hard', 'team', 'speed', 'puzzle', 'classic', 'remake', 'long']

function mapRow(index: number): AdminMapRow {
    const author = person(index + 70)
    return {
        name: syntheticMap(index),
        active: index % 9 !== 8,
        difficulty: (index % 10) + 1,
        tags: `${MAP_TAGS[index % MAP_TAGS.length]},${MAP_TAGS[(index + 3) % MAP_TAGS.length]}`,
        url: 'https://example.com/maps/download',
        changelog: 'Fixed a stuck spot near the flag room.',
        author_str: author.alias,
        author_ref: author.id,
        author_alias: author.alias,
        superseded_by: index % 13 === 12 ? syntheticMap(index + 1) : null,
        preceded_by: index % 13 === 0 && index ? syntheticMap(index - 1) : null,
        added: daysAgo(index * 4),
        required_players: index % 7 === 0 ? 2 : 1,
        has_screenshot: true,
        screenshot_updated: daysAgo(index * 4),
        has_video: index % 4 === 0,
        video_updated_at: index % 4 === 0 ? daysAgo(index) : null,
    }
}

const mapvote: MapvoteStatus = {
    announcement: 'Welcome to the test server. New maps every Friday.',
    last_regenerated_at: hoursAgo(5),
    cooldown_seconds_remaining: 0,
    can_regenerate: true,
}

const difficultySync: DifficultySyncChange[] = Array.from({ length: 6 }, (_, index) => ({
    name: syntheticMap(index * 3),
    current: (index % 10) + 1,
    average: index + 2.4,
    review_count: 5 + index * 3,
    proposed: index + 2,
}))

const patches: AdminPatch[] = Array.from({ length: 8 }, (_, index) => ({
    id: `synthetic-patch-${index + 1}`,
    channel: index % 3 === 2 ? 'beta' : 'stable',
    tag: `v4.${8 - index}.0`,
    asset_name: `test-patch-v4.${8 - index}.0.zip`,
    asset_url: `https://example.com/patches/test-patch-v4.${8 - index}.0.zip`,
    sha256: '0'.repeat(64),
    exe_md5: '0'.repeat(32),
    release_notes_url: 'https://example.com/patches/notes',
    active: index < 2,
    added: daysAgo(index * 21),
}))

function sharedGroup(index: number): AcSharedGroup {
    const ip = index % 2 === 1
    const players = Array.from({ length: 2 + (index % 3) }, (_, member) => {
        const someone = person(index * 3 + member)
        return { id: someone.id, alias: someone.alias, active_title: ACTIVE_TITLE }
    })
    return {
        type: ip ? 'ip' : 'hwid',
        value: ip ? documentationIp(index) : fakeHwid(index),
        player_count: players.length,
        cap_count: 30 + index * 7,
        first_seen: daysAgo(200 - index),
        last_seen: daysAgo(index),
        players,
    }
}

function capDeltaRow(index: number): AcCapDeltaRow {
    const someone = person(index + 5)
    return {
        cap_id: capRow(index).id,
        user: someone.id,
        alias: someone.alias,
        active_title: ACTIVE_TITLE,
        map: syntheticMap(index),
        cap_time_seconds: 38.2 + index,
        client_cap_delta: 0.9 + index * 0.13,
        verified: index % 4 === 0,
        ip: documentationIp(index + 100),
        hwid: fakeHwid(index + 100),
        btpog_id: fakeBtpog(index + 100),
        added: hoursAgo(index * 7),
    }
}

const FPS_TIERS: AcLowFpsWrRow['tier'][] = ['critical', 'high', 'medium', 'low']

function lowFpsRow(index: number): AcLowFpsWrRow {
    const someone = person(index + 9)
    return {
        cap_id: capRow(index + 200).id,
        user: someone.id,
        alias: someone.alias,
        active_title: ACTIVE_TITLE,
        map: syntheticMap(index + 4),
        cap_time_seconds: 52.8 + index,
        fps_1pc: 18 + index,
        fps_5pc: 31 + index,
        fps_25pc: 64 + index,
        fps_50pc: 88 + index,
        set_fps_min: 60,
        set_fps_max: 200,
        netspeed_min: 10000,
        netspeed_max: 20000,
        spawn_count: 3 + (index % 4),
        baseline_fps: 140,
        tier: FPS_TIERS[index % FPS_TIERS.length],
        flags: ['low_1pc', 'fps_cap_change'].slice(0, 1 + (index % 2)),
        added: hoursAgo(index * 5),
    }
}

const AUDIT_ACTIONS = ['cap.disallow', 'user.warn', 'user.ban', 'map.update', 'title.assign', 'news.publish', 'event.update']

function auditRow(index: number): AuditEntry {
    const actor = index % 5 === 0 ? VIEWER : person(index % 4 + 30)
    const target = person(index + 11)
    return {
        id: `synthetic-audit-${index + 1}`,
        action: AUDIT_ACTIONS[index % AUDIT_ACTIONS.length],
        actor_id: actor.id,
        actor_alias: actor.alias,
        actor_role: index % 5 === 0 ? ROLE.ADMIN : ROLE.MODERATOR,
        actor_title: ACTIVE_TITLE,
        target_type: 'user',
        target_id: target.id,
        target_alias: target.alias,
        summary: `${AUDIT_ACTIONS[index % AUDIT_ACTIONS.length]} on ${target.alias}`,
        details: { before: { difficulty: 4 }, after: { difficulty: 5 } },
        reason: index % 3 ? 'Reported in the support channel' : null,
        ip: documentationIp(index + 300),
        created_at: hoursAgo(index * 2),
        reverts: null,
        reverted: index % 13 === 6,
        can_rollback: index % 2 === 0,
    }
}

const roles: AdminRoleRow[] = Array.from({ length: 7 }, (_, index) => ({
    user: person(index + 30).id,
    alias: person(index + 30).alias,
    flag: person(index + 30).flag,
    role: index < 2 ? ROLE.ADMIN : index < 5 ? ROLE.MODERATOR : ROLE.CUP_ADMIN,
    granted_by: VIEWER.id,
    granted_by_alias: VIEWER.alias,
    note: index % 2 ? 'Covers the evening shift' : null,
    granted_at: daysAgo(300 - index * 30),
}))

const REGIONS = ['EU', 'NA', 'SA', 'OCE']

const hosts: AdminHostsResponse = {
    hosts: REGIONS.map((region, index) => ({
        id: `synthetic-host-${index + 1}`,
        name: `test-host-${region.toLowerCase()}`,
        region,
        ip: documentationIp(index + 400),
        agent_port: 7000 + index,
        active: index !== 3,
        created_at: daysAgo(400 - index * 50),
        token: index === 2 ? null : {
            id: `synthetic-token-${index + 1}`,
            name: `test-host-${region.toLowerCase()} token`,
            scopes: ['records:write', 'status:write'],
            active: true,
            created_at: daysAgo(100 - index),
            last_seen_at: hoursAgo(index + 1),
        },
    })),
    servers: Array.from({ length: 8 }, (_, index) => ({
        id: `synthetic-server-${index + 1}`,
        name: `Test BT Server #${index + 1} | ${REGIONS[index % REGIONS.length]}`,
        region: REGIONS[index % REGIONS.length],
        ip: documentationIp(index + 420),
        port: 7777 + index * 100,
        active: index !== 7,
        certified_records: index % 3 !== 2,
        state: index % 4 === 3 ? 'maintenance' : 'online',
        host_ref: index < 6 ? `synthetic-host-${(index % 4) + 1}` : null,
    })),
    available_scopes: ['records:write', 'status:write', 'demos:write'],
}

function withSyntheticIds(value: unknown): unknown {
    if (typeof value === 'string' && /^\d{15,20}$/.test(value)) return syntheticId(Number(value.slice(-4)) + 500)
    if (Array.isArray(value)) return value.map(withSyntheticIds)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, withSyntheticIds(field)]))
    return value
}

function uploads(name: 'drafts' | 'publishes' | 'drift'): FixtureReply {
    return { json: withSyntheticIds(MAP_UPLOAD_FIXTURES[name].body) }
}

export const ADMIN_SET: FixtureSet = {
    name: 'admin',
    routes: [
        ...sessionRoutes(ROLE.ADMIN),
        { host: 'api', path: '/admin/overview', reply: ok(overview) },
        { host: 'api', path: '/admin/overview/activity', reply: activity },
        { host: 'api', path: '/admin/usage', reply: usage },
        { host: 'api', path: '/admin/usage/recent', reply: ok(usageRecent) },
        ...paged('/admin/users', userRow, 4812),
        { host: 'api', path: /^\/admin\/users\/\d+$/, reply: url => ok(userDetail(url.pathname.split('/').pop() ?? '')) },
        items('/admin/titles', titles),
        { host: 'api', path: /^\/admin\/titles\/[^/]+\/holders$/, reply: ok({ items: titleHolders }) },
        items('/admin/news', news),
        items('/admin/news/categories', newsCategories),
        items('/tournaments', events),
        { host: 'api', path: /^\/tournaments\/test-cup-\d+\/managers$/, reply: ok({ items: eventManagers }) },
        items('/tournaments/formats', FORMATS),
        { host: 'api', path: /^\/tournaments\/test-cup-\d+$/, reply: url => ok({ tournament: events.find(event => url.pathname.endsWith(`/${event.slug}`)) ?? events[0] }) },
        items('/admin/streamers', roster),
        items('/admin/streamers/suggestions', suggestions),
        ...paged('/admin/caps', capRow, 51234),
        ...paged('/admin/maps', mapRow, 612),
        items('/admin/maps/tags', MAP_TAGS),
        { host: 'api', path: '/admin/mapvote', reply: ok(mapvote) },
        { host: 'api', path: '/admin/maps/difficulty-sync/preview', reply: ok({ changes: difficultySync }) },
        { host: 'api', path: '/admin/map-uploads/drafts', reply: uploads('drafts') },
        { host: 'api', path: '/admin/map-uploads/publishes', reply: uploads('publishes') },
        { host: 'api', path: '/admin/map-uploads/drift', reply: uploads('drift') },
        items('/admin/patches', patches),
        ...paged('/admin/anti-cheat/shared', sharedGroup, 143),
        ...paged('/admin/anti-cheat/cap-delta', capDeltaRow, 87),
        ...paged('/admin/anti-cheat/low-fps-wr', lowFpsRow, 64),
        ...paged('/admin/audit', auditRow, 18342),
        items('/admin/roles', roles),
        { host: 'api', path: '/admin/hosts', reply: ok(hosts) },
    ],
}
