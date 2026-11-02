import { hasRecording, recordedFixtureSet } from './recording'
import { stressed, STRESS_VARIANTS, type StressVariant } from './stress'
import type { FixtureReply, FixtureSet } from './types'

export const RECORDED_SETS: readonly string[] = [
    'home',
    'servers',
    'maps',
    'maps-detail',
    'players',
    'player-detail',
    'teams',
    'team-detail',
    'events',
    'event-detail',
    'match-pickban',
    'event-team',
    'world-records',
    'cap-it-all',
    'cap-detail',
    'team-cap-detail',
    'achievements',
    'news',
    'news-detail',
]

export const FIXTURE_SETS: Readonly<Record<string, FixtureSet>> = Object.fromEntries(
    RECORDED_SETS.filter(hasRecording).map(recordedFixtureSet).map(set => [set.name, set]),
)

function isVariant(value: string): value is StressVariant {
    return (STRESS_VARIANTS as readonly string[]).includes(value)
}

function stressedSet(set: FixtureSet, variant: StressVariant): FixtureSet {
    const stress = (reply: FixtureReply): FixtureReply => ({ ...reply, json: stressed(variant, reply.json) })
    return {
        name: `${set.name}~${variant}`,
        routes: set.routes.map(route => ({
            ...route,
            reply: typeof route.reply === 'function' ? (url => stress((route.reply as (url: URL) => FixtureReply)(url))) : stress(route.reply),
        })),
    }
}

export function fixtureSetNamed(name: string): FixtureSet | undefined {
    const [base, variant, ...rest] = name.split('~')
    const set = FIXTURE_SETS[base]
    if (!set || rest.length) return undefined
    if (variant === undefined) return set
    return isVariant(variant) ? stressedSet(set, variant) : undefined
}
