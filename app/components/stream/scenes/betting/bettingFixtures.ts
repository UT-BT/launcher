import type { RawActiveTitle } from '@/app/utils/api'
import type {
    BettingBacker,
    BettingMarket,
    BettingRead,
    BettingResult,
    BettingResultOutcome,
    BettingSide,
    BettingSides,
    BettingState,
} from './bettingRead'
import { STREAM_MATCH_ID, STREAM_T0, streamIso } from '../../data/streamFixtures'

const MINUTE = 60_000

const ORACLE: RawActiveTitle = { name: 'Oracle', rarity: 3, color_r: 52, color_g: 211, color_b: 153 }

const PLAYERS = {
    harbinger: ['310000000000000001', 'Harbinger'],
    nimbus: ['310000000000000002', 'Nimbus'],
    tessel: ['310000000000000003', 'Tessel'],
    quokka: ['310000000000000004', 'Quokka'],
    lumen: ['310000000000000005', 'Lumen'],
    ferrum: ['310000000000000006', 'Ferrum'],
    pogo: ['310000000000000007', 'Pogo'],
    moth: ['310000000000000008', 'Moth'],
    rook: ['310000000000000009', 'Rook'],
    wisp: ['310000000000000010', 'Wisp'],
    fennel: ['310000000000000011', 'Fennel'],
    sable: ['310000000000000012', 'Sable'],
} as const

export type BettingPlayer = keyof typeof PLAYERS

function backer(userId: string, name: string, stake: number, payout: number, title: RawActiveTitle | null = null): BettingBacker {
    return {
        user_id: userId,
        display_name: name,
        avatar: `https://example.test/users/${userId}/avatar`,
        title,
        stake,
        payout,
        multiplier: Math.round((payout / stake) * 100) / 100,
        biggest: false,
        outcome: null,
        profit: null,
        payout_state: null,
    }
}

export function bettingBacker(player: BettingPlayer, stake: number, payout: number, overrides: Partial<BettingBacker> = {}): BettingBacker {
    const [userId, name] = PLAYERS[player]
    return { ...backer(userId, name, stake, payout, player === 'harbinger' ? ORACLE : null), ...overrides }
}

const BACKERS_A: BettingBacker[] = [
    bettingBacker('nimbus', 1500, 2610),
    bettingBacker('quokka', 800, 1408),
    bettingBacker('ferrum', 500, 845),
    bettingBacker('lumen', 250, 440),
    bettingBacker('pogo', 100, 181),
    bettingBacker('fennel', 90, 160),
]

const BACKERS_B: BettingBacker[] = [
    bettingBacker('harbinger', 3000, 7350, { biggest: true }),
    bettingBacker('tessel', 1000, 2290),
    bettingBacker('moth', 600, 1452),
    bettingBacker('rook', 300, 693),
    bettingBacker('wisp', 150, 348),
    bettingBacker('sable', 120, 280),
]

function stakeOf(backers: BettingBacker[]): number {
    return backers.reduce((sum, backer) => sum + backer.stake, 0)
}

export function bettingSide(name: string | null, price: number, overrides: Partial<BettingSide> = {}): BettingSide {
    const backers = overrides.backers ?? []
    return {
        team: name === null ? null : { id: `team-${name.toLowerCase().replace(/\s+/g, '-')}`, name },
        price,
        odds: Math.round((1 / price) * 100) / 100,
        count: backers.length,
        stake: stakeOf(backers),
        backers,
        ...overrides,
    }
}

type MarketKey = 'a' | 'b' | 'draw'

function decided(backers: BettingBacker[], side: MarketKey, state: BettingState, outcome: BettingResultOutcome): BettingBacker[] {
    if (state === 'voided') return backers.map(backer => ({ ...backer, outcome: 'refunded', profit: 0, payout_state: 'paid' }))
    if (state !== 'resolved' && state !== 'settled') return backers
    const payoutState = state === 'resolved' ? 'pending' : 'paid'
    return backers.map(backer => {
        const won = outcome === side
        return { ...backer, outcome: won ? 'won' : 'lost', profit: won ? backer.payout - backer.stake : -backer.stake, payout_state: won ? payoutState : null }
    })
}

const TIMES: Record<BettingState, Partial<BettingMarket>> = {
    not_enabled: {},
    no_market: {},
    open: {},
    closed: { closed_at: streamIso(STREAM_T0 - 30 * MINUTE) },
    resolved: { closed_at: streamIso(STREAM_T0 - 90 * MINUTE), resolved_at: streamIso(STREAM_T0 - 10 * MINUTE), settles_at: streamIso(STREAM_T0 + 170 * MINUTE) },
    settled: { closed_at: streamIso(STREAM_T0 - 300 * MINUTE), resolved_at: streamIso(STREAM_T0 - 240 * MINUTE), settles_at: streamIso(STREAM_T0 - 60 * MINUTE), settled_at: streamIso(STREAM_T0 - 58 * MINUTE) },
    voided: { closed_at: streamIso(STREAM_T0 - 30 * MINUTE), settled_at: streamIso(STREAM_T0 - 20 * MINUTE) },
}

function market(state: BettingState, sides: BettingSides | null): BettingMarket | null {
    if (state === 'not_enabled' || state === 'no_market') return null
    const all = sides ? [sides.a, sides.b, ...(sides.draw ? [sides.draw] : [])].flatMap(side => side.backers) : []
    return {
        status: state,
        draws_allowed: sides?.draw != null,
        pool: state === 'open' ? 14_750 : stakeOf(all),
        predictions: state === 'open' ? 164 : all.length,
        closes_at: streamIso(STREAM_T0 + 80 * MINUTE),
        closed_at: null,
        resolved_at: null,
        settles_at: null,
        settled_at: null,
        ...TIMES[state],
    }
}

function sides(state: BettingState): BettingSides | null {
    if (state === 'not_enabled' || state === 'no_market') return null
    if (state === 'open') return { a: bettingSide('Crimson Cats', 0.58), b: bettingSide('Azure Owls', 0.42), draw: null }
    return {
        a: bettingSide('Crimson Cats', 0.58, { backers: decided(BACKERS_A, 'a', state, 'a') }),
        b: bettingSide('Azure Owls', 0.42, { backers: decided(BACKERS_B, 'b', state, 'a') }),
        draw: null,
    }
}

function result(state: BettingState, outcome: BettingResultOutcome): BettingResult | null {
    if (state === 'not_enabled' || state === 'no_market') return null
    if (state === 'voided') return { status: 'voided', outcome: 'void', refunded: true, reason: 'The match was cancelled', payout_state: 'paid' }
    if (state === 'resolved' || state === 'settled') {
        return { status: 'official', outcome, refunded: false, reason: null, payout_state: state === 'resolved' ? 'pending' : 'paid' }
    }
    return { status: 'awaiting', outcome: null, refunded: false, reason: null, payout_state: null }
}

export function bettingRead(state: BettingState, overrides: Partial<BettingRead> = {}): BettingRead {
    const marketSides = sides(state)
    return {
        server_now: streamIso(STREAM_T0),
        match_id: STREAM_MATCH_ID,
        state,
        market: market(state, marketSides),
        positions_visible: state !== 'open' && marketSides !== null,
        sides: marketSides,
        result: result(state, 'a'),
        ...overrides,
    }
}

const ALIASES = [
    'Harbinger', 'Nimbus', 'Tessel', 'Quokka', 'Lumen', 'Ferrum', 'Pogo', 'Moth', 'Rook', 'Wisp',
    'Fennel', 'Sable', 'Kiwi', 'Zest', 'Brine', 'Nox', 'Juno', 'Pike', 'Sorrel', 'Quill',
    'Tansy', 'Gnash', 'Lark', 'Mako', 'Oriel', 'Vex', 'Yarrow', 'Zinc', 'Bramble', 'Cobalt',
    'Dune', 'Fjord', 'Glint', 'Haze', 'Ibex', 'Jinx', 'Knot', 'Loam', 'Mire', 'Nettle',
    'Driftwood', 'Paperkite', 'Saltmarsh', 'Gloamrider', 'Tumbleweed', 'Copperhead', 'Marrowind', 'Starling', 'Thistledown', 'Moonquay',
    'Lanternfish', 'Hopscotch', 'Brightwater', 'Cindermoss', 'Pebbledash', 'Kettledrum', 'Wanderlust', 'Foxglove', 'Windchime', 'Quicksilver',
    '[BH]Glidewalker', 'xX_SilentStrafe_Xx', 'NightOwlBunnyHop', 'Mr.Pancake.Wizard', '|RX|Thunderhopper', 'CaptainCrumpet99', 'TheLastSkyHopper', '~Velvet~Avalanche', 'Sir.Hopsalot.III', 'LongJumpLarry',
    'AnvilOfTheNorth', '[kek]CosmicNoodle', 'QuietlyStrafing', 'BigRedTrampoline', 'Zero.Gravity.Gus', 'PixelatedPelican', 'ButteredToast_UT', 'ElevatorMusic42', 'NoScopeNibbler', 'SundayDriverSam',
    'Onyx', 'Plume', 'Quartz', 'Rime', 'Silt', 'Tarn', 'Umber', 'Vale', 'Wren', 'Ember',
    'Snapdragon', 'Blueberry', 'Gravelpit', 'Owlbear', 'Teacup', 'Cloudberry', 'Duskwing', 'Mudlark', 'Pinwheel', 'Riverstone',
    'Spoonbill', 'Featherfall', 'Hailstone', 'Ironbark', 'Juniper', 'Kingfisher', 'Larkspur', 'Mothwing', 'Nightjar', 'Overcast',
    '[UT]Bobsleigh', 'Jumpy.McJumpface', 'FlatlineFrank', 'Crouchwalker_9', 'WallHuggerWes', 'Velcro_Vanguard', 'LowGravLiz', 'StrafeLeftOnly', 'TrampolineTom', 'AirTimeAnnie',
    'Glimmer', 'Brisket', 'Corvid', 'Doppler', 'Elkhorn', 'Fathom', 'Grizzle', 'Halyard', 'Inkcap', 'Jetsam',
]

const STAKES = [100, 100, 100, 150, 200, 200, 250, 300, 300, 400, 500, 500, 500, 600, 750, 800, 1000, 1000, 1200, 1500, 2000, 2500, 3000]

function seeded(seed: number): () => number {
    let state = seed >>> 0
    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function people(seed: number): () => { id: string; alias: string } {
    const random = seeded(seed)
    const order = ALIASES.map((alias, index) => ({ alias, id: `3200000000000${String(index + 1).padStart(5, '0')}` }))
    for (let index = order.length - 1; index > 0; index -= 1) {
        const pick = Math.floor(random() * (index + 1))
        ;[order[index], order[pick]] = [order[pick], order[index]]
    }
    let cursor = 0
    return () => order[cursor++]
}

interface ShapeSpec {
    seed: number
    counts: Record<MarketKey, number | null>
    ranges: Record<MarketKey, [number, number] | null>
    prices: Record<MarketKey, number | null>
}

export const BETTING_SHAPES = {
    '29/2/2': { seed: 29, counts: { a: 29, draw: 2, b: 2 }, ranges: { a: [1.3, 1.7], draw: [7, 12], b: [2.6, 3.8] }, prices: { a: 0.64, draw: 0.07, b: 0.29 } },
    '21/6/4': { seed: 21, counts: { a: 21, draw: 6, b: 4 }, ranges: { a: [1.45, 1.9], draw: [5, 9], b: [2.3, 3.2] }, prices: { a: 0.58, draw: 0.14, b: 0.28 } },
    '14/11/3': { seed: 14, counts: { a: 14, draw: 11, b: 3 }, ranges: { a: [2.0, 2.6], draw: [3.2, 4.5], b: [4.0, 6.0] }, prices: { a: 0.4, draw: 0.27, b: 0.33 } },
    '80/7': { seed: 80, counts: { a: 80, draw: null, b: 7 }, ranges: { a: [1.1, 1.3], draw: null, b: [4.0, 7.0] }, prices: { a: 0.85, draw: null, b: 0.15 } },
} as const satisfies Record<string, ShapeSpec>

export type BettingShape = keyof typeof BETTING_SHAPES

type Placed = BettingBacker & { placed: number }

function placedBackers(count: number, range: readonly [number, number], random: () => number, next: () => { id: string; alias: string }): Placed[] {
    const opened = STREAM_T0 - 3 * 24 * 60 * MINUTE
    const backers = Array.from({ length: count }, () => {
        const person = next()
        const stake = STAKES[Math.floor(random() * STAKES.length)]
        const payout = Math.floor(stake * (Math.round((range[0] + random() * (range[1] - range[0])) * 100) / 100))
        const placed = opened + Math.floor(random() * 600) * MINUTE
        return { ...backer(person.id, person.alias, stake, payout), placed }
    })
    return backers.sort((x, y) => y.payout - x.payout || y.stake - x.stake || x.placed - y.placed || x.user_id.localeCompare(y.user_id))
}

export function bettingMarketRead(shape: BettingShape, state: BettingState, outcome: BettingResultOutcome = 'a'): BettingRead {
    const spec: ShapeSpec = BETTING_SHAPES[shape]
    const random = seeded(spec.seed)
    const next = people(spec.seed * 7 + 1)
    const keys: MarketKey[] = spec.counts.draw === null ? ['a', 'b'] : ['a', 'draw', 'b']
    const placed = Object.fromEntries(keys.map(key => [key, placedBackers(spec.counts[key] ?? 0, spec.ranges[key] ?? [1, 1], random, next)])) as Record<MarketKey, Placed[]>
    const biggest = keys.flatMap(key => placed[key]).sort((x, y) => y.stake - x.stake || x.placed - y.placed)[0]
    const side = (key: MarketKey): BettingSide => {
        const backers = placed[key].map(({ placed: _placed, ...backer }) => ({ ...backer, biggest: backer.user_id === biggest.user_id }))
        const name = key === 'a' ? 'Crimson Cats' : key === 'b' ? 'Azure Owls' : null
        return bettingSide(name, spec.prices[key] ?? 1, { backers: decided(backers, key, state, outcome) })
    }
    const marketSides: BettingSides = { a: side('a'), b: side('b'), draw: spec.counts.draw === null ? null : side('draw') }
    return {
        server_now: streamIso(STREAM_T0),
        match_id: STREAM_MATCH_ID,
        state,
        market: market(state, marketSides),
        positions_visible: true,
        sides: marketSides,
        result: result(state, outcome),
    }
}
