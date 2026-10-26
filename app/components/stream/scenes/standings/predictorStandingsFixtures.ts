import type { RawActiveTitle } from '@/app/utils/api'
import { STREAM_T0, streamIso } from '../../data/streamFixtures'
import type { PredictorStandings, PredictorStandingsRow } from './predictorStandingsRead'

const GRANTED = 10_000

const TITLES: RawActiveTitle[] = [
    { name: 'High Roller', rarity: 3, color_r: 240, color_g: 180, color_b: 41 },
    { name: 'Long Shot', rarity: 2, color_r: 167, color_g: 139, color_b: 250 },
    { name: 'Bunny Whisperer', rarity: 3, color_r: 56, color_g: 189, color_b: 248 },
]

type CompactRow = [
    rank: number,
    id: string,
    alias: string,
    profit: number,
    placed: number,
    won: number,
    lost: number,
    refunded: number,
    pendingCount: number,
    movement: number | 'new',
    title: number | null,
]

const BOARD: CompactRow[] = [
    [1, '25', 'Oriel', 6185, 23, 13, 10, 0, 0, 0, 0],
    [2, '14', 'Zest', 5490, 21, 14, 6, 2, 0, 0, 1],
    [3, '42', 'Paperkite', 4936, 18, 9, 7, 0, 1, 1, null],
    [4, '13', 'Kiwi', 4775, 5, 2, 1, 0, 0, -1, null],
    [5, '40', 'Nettle', 3830, 23, 16, 7, 1, 0, 1, null],
    [6, '47', 'Marrowind', 3502, 10, 5, 4, 1, 1, 5, 1],
    [7, '39', 'Mire', 3482, 17, 12, 4, 0, 1, 2, null],
    [8, '05', 'Lumen', 3345, 22, 13, 9, 2, 0, 0, null],
    [9, '35', 'Ibex', 2970, 8, 2, 5, 0, 1, 3, null],
    [10, '11', 'Fennel', 2930, 9, 6, 1, 0, 1, 3, null],
    [11, '33', 'Glint', 2870, 13, 3, 8, 1, 1, -4, null],
    [12, '19', 'Sorrel', 2820, 5, 3, 1, 0, 0, 2, null],
    [13, '02', 'Nimbus', 2468, 5, 2, 1, 1, 1, 3, null],
    [14, '01', 'Harbinger', 2341, 8, 2, 5, 1, 1, 1, null],
    [15, '44', 'Gloamrider', 2340, 23, 16, 6, 0, 1, -5, null],
    [16, '30', 'Cobalt', 2198, 17, 12, 5, 2, 1, 6, null],
    [17, '41', 'Driftwood', 2096, 22, 16, 4, 2, 1, 0, null],
    [18, '12', 'Sable', 1745, 16, 11, 5, 1, 0, 0, null],
    [19, '15', 'Brine', 1635, 5, 2, 3, 2, 0, 0, null],
    [20, '09', 'Rook', 1619, 16, 7, 9, 2, 1, 1, null],
    [21, '22', 'Gnash', 1535, 14, 9, 5, 0, 1, -16, null],
    [21, '03', 'Tessel', 1535, 21, 8, 13, 0, 1, -2, 1],
    [23, '20', 'Quill', 1135, 18, 7, 10, 1, 0, 0, null],
    [24, '24', 'Mako', 615, 5, 3, 2, 2, 0, 1, null],
    [25, '31', 'Dune', 536, 21, 14, 5, 1, 1, 2, null],
    [26, '28', 'Zinc', 417, 5, 2, 2, 1, 1, 0, 2],
    [27, '08', 'Moth', 290, 20, 14, 6, 0, 1, -3, null],
    [28, '27', 'Yarrow', 138, 1, 1, 0, 0, 1, 'new', null],
    [29, '45', 'Tumbleweed', -38, 5, 3, 0, 0, 1, 1, null],
    [30, '04', 'Quokka', -235, 12, 8, 3, 2, 0, -1, 2],
    [31, '43', 'Saltmarsh', -607, 25, 14, 11, 2, 1, 8, null],
    [32, '49', 'Thistledown', -646, 17, 11, 6, 2, 1, 0, null],
    [33, '10', 'Wisp', -750, 13, 9, 4, 2, 0, -2, null],
    [34, '48', 'Starling', -800, 10, 4, 4, 1, 1, -6, null],
    [35, '46', 'Copperhead', -871, 13, 7, 5, 0, 1, 0, null],
    [36, '51', 'Lanternfish', -907, 16, 6, 8, 1, 1, -3, 0],
    [37, '52', 'Hopscotch', -967, 25, 9, 16, 1, 1, -3, null],
    [38, '21', 'Tansy', -1375, 7, 2, 5, 1, 0, -2, null],
    [39, '26', 'Vex', -1500, 1, 0, 1, 0, 1, 'new', 2],
    [40, '16', 'Nox', -1815, 19, 10, 7, 2, 0, -3, null],
    [41, '50', 'Moonquay', -1963, 19, 10, 8, 2, 1, 3, null],
    [42, '37', 'Knot', -2140, 14, 7, 7, 2, 0, -4, null],
    [43, '38', 'Loam', -2740, 10, 4, 5, 1, 0, -1, null],
    [44, '06', 'Ferrum', -2810, 11, 4, 5, 2, 1, 3, 0],
    [45, '18', 'Pike', -2910, 4, 1, 3, 0, 1, -5, null],
    [46, '23', 'Lark', -3120, 4, 2, 2, 2, 0, -3, null],
    [47, '17', 'Juno', -3620, 20, 8, 11, 0, 1, -6, null],
    [48, '34', 'Haze', -3740, 3, 1, 1, 0, 1, -3, null],
    [49, '36', 'Jinx', -3755, 9, 4, 4, 2, 1, -3, null],
    [50, '29', 'Bramble', -4960, 7, 1, 5, 1, 1, -2, null],
    [51, '32', 'Fjord', -4985, 18, 4, 12, 1, 1, -2, null],
    [52, '07', 'Pogo', -5004, 21, 6, 14, 1, 1, -2, null],
]

function rowOf([rank, id, alias, profit, placed, won, lost, refunded, pendingCount, movement, title]: CompactRow): PredictorStandingsRow {
    const userId = `3200000000000000${id}`
    return {
        rank,
        user_id: userId,
        display_name: alias,
        avatar: `https://example.test/users/${userId}/avatar`,
        title: title === null ? null : TITLES[title],
        net_worth: GRANTED + profit,
        profit,
        bets_placed: placed,
        positions_won: won,
        positions_lost: lost,
        positions_refunded: refunded,
        pending: pendingCount > 0,
        pending_count: pendingCount,
        movement: movement === 'new' ? null : movement,
        new: movement === 'new',
    }
}

function extraRow(index: number, previous: PredictorStandingsRow): PredictorStandingsRow {
    const profit = previous.profit - 35 - (index % 4) * 10
    const userId = `33000000000000${String(index).padStart(4, '0')}`
    return {
        ...previous,
        rank: index + 1,
        user_id: userId,
        display_name: index % 4 === 0 ? `[BH]Glidewalker.${index + 1}_xX` : `Predictor ${index + 1}`,
        avatar: `https://example.test/users/${userId}/avatar`,
        title: null,
        net_worth: GRANTED + profit,
        profit,
        positions_won: index % 5,
        positions_lost: 3 + (index % 3),
        pending: index % 3 === 0,
        pending_count: index % 3 === 0 ? 1 : 0,
        movement: index % 7 === 0 ? 1 : -(index % 4),
        new: false,
    }
}

export function predictorBoard(count = BOARD.length): PredictorStandingsRow[] {
    const rows = BOARD.slice(0, count).map(rowOf)
    for (let index = rows.length; index < count; index++) rows.push(extraRow(index, rows[index - 1]))
    return rows
}

export function predictorStandingsRead(overrides: Partial<PredictorStandings> & { count?: number } = {}): PredictorStandings {
    const { count, ...rest } = overrides
    const items = rest.items ?? predictorBoard(count)
    return {
        server_now: streamIso(STREAM_T0),
        any_pending: items.some(item => item.pending),
        focus_market: { market_id: 'market-standings', status: 'resolved', outcome: 'a', movement: true },
        total: items.length,
        items,
        ...rest,
    }
}

export function withoutMovement(read: PredictorStandings): PredictorStandings {
    return {
        ...read,
        focus_market: null,
        items: read.items.map(item => ({ ...item, movement: null, new: false })),
    }
}

export function withoutPending(read: PredictorStandings): PredictorStandings {
    return {
        ...read,
        any_pending: false,
        items: read.items.map(item => ({ ...item, pending: false, pending_count: 0 })),
    }
}
