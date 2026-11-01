import type { HotMap, Summary, SummaryNewMap, SummaryWorldRecord } from '../../../app/utils/api'
import { daysAgo, ok, type FixtureSet } from './types'

export const HOME_RECORDS: SummaryWorldRecord[] = [
    { id: 'wr-1', mapName: 'CTF-BT-Coalescence', userId: '1001', alias: 'Velocity', time: 41.218, added: daysAgo(1), timeAgo: '1 day ago' },
    { id: 'wr-2', mapName: 'CTF-BT-LongestMapNameInTheRotationEver', userId: '1002', alias: 'AnExtremelyLongPlayerAlias', time: 125.004, added: daysAgo(2), timeAgo: '2 days ago' },
    { id: 'wr-3', mapName: 'CTF-BT-Skyline', userId: '1003', alias: 'Hopper', time: 63.5, added: daysAgo(3), timeAgo: '3 days ago' },
    { id: 'wr-4', mapName: 'CTF-BT-Tundra', userId: '1004', alias: 'Glide', time: 88.75, added: daysAgo(5), timeAgo: '5 days ago' },
    { id: 'wr-5', mapName: 'CTF-BT-Canyon', userId: null, alias: null, time: 19.99, added: daysAgo(8), timeAgo: '8 days ago' },
]

const NEW_MAPS: SummaryNewMap[] = [
    { name: 'CTF-BT-Aurora', author: 'Mapper One', difficulty: 4, tags: 'Fun', added: daysAgo(2), timeAgo: '2 days ago' },
    { name: 'CTF-BT-Basalt', author: 'Mapper Two', difficulty: 7, tags: 'Hard,Long', added: daysAgo(4), timeAgo: '4 days ago' },
    { name: 'CTF-BT-Cobalt', author: 'Mapper Three', difficulty: 2, tags: null, added: daysAgo(9), timeAgo: '9 days ago' },
]

const SUMMARY: Summary = {
    global: { newMaps: NEW_MAPS.length, newRecords: HOME_RECORDS.length },
    achievements: [],
    recentWorldRecords: HOME_RECORDS,
    newMaps: NEW_MAPS,
    latestPatch: null,
}

const HOT_MAPS: HotMap[] = [
    { name: 'CTF-BT-Coalescence', author: 'Mapper One', difficulty: 5, ingameSeconds: 36_000, spectateSeconds: 1_200, players: 14 },
    { name: 'CTF-BT-Skyline', author: 'Mapper Two', difficulty: 3, ingameSeconds: 24_000, spectateSeconds: 600, players: 9 },
    { name: 'CTF-BT-Tundra', author: 'Mapper Three', difficulty: 8, ingameSeconds: 18_000, spectateSeconds: 300, players: 6 },
    { name: 'CTF-BT-Canyon', author: 'Mapper Four', difficulty: 1, ingameSeconds: 9_000, spectateSeconds: 120, players: 4 },
]

function newsRow(id: number, title: string, days: number, pinned = false) {
    return {
        id,
        category: 'update',
        title,
        excerpt: `${title}: what changed and why it matters for your runs.`,
        body: `${title} body`,
        pinned,
        published_at: daysAgo(days),
        author_alias: 'Staff',
    }
}

export const homeFixtures: FixtureSet = {
    name: 'home',
    routes: [
        { host: 'api', path: '/v2/summary', reply: ok(SUMMARY) },
        { host: 'api', path: '/v2/summary/hot_maps', reply: ok(HOT_MAPS) },
        {
            host: 'api',
            path: '/v2/news',
            reply: ok({ items: [newsRow(3, 'Launcher update with phone layouts', 1, true), newsRow(2, 'New maps this week', 4), newsRow(1, 'Season results', 12)] }),
        },
        {
            host: 'api',
            path: '/v2/news/categories',
            reply: ok({ items: [{ id: 1, key: 'update', label: 'Update', color_r: 96, color_g: 165, color_b: 250, icon: 'sparkles', sort_order: 1 }] }),
        },
        { host: 'api', path: '/v2/players/count', reply: ok({ count: 1_284 }) },
        { host: 'api', path: '/maps/count', reply: ok({ count: 342 }) },
    ],
}
