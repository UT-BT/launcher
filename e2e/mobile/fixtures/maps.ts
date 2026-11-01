import type { Map } from '../../../app/utils/api'
import { daysAgo, ok, type FixtureSet } from './types'

export const MAPS_LIST: Map[] = [
    { name: 'CTF-BT-Aurora', added: daysAgo(2), difficulty: 4, active: true, tags: 'Fun', author: 'Mapper One', required_players: 1, world_record: 42.5 },
    { name: 'CTF-BT-BasaltWithAVeryLongMapNameThatMustNotOverflow', added: daysAgo(10), difficulty: 8, active: true, tags: 'Hard,Long', author: 'Mapper Two', required_players: 1, world_record: 125.25 },
    { name: 'CTF-BT-Cobalt', added: daysAgo(40), difficulty: 5, active: true, author: 'Mapper Three', required_players: 2, world_record: 77.125 },
    { name: 'CTF-BT-Dune', added: daysAgo(90), difficulty: 2, active: true, tags: 'Fun,Short', author: 'Mapper One', required_players: 1, world_record: 18.75 },
    { name: 'CTF-BT-Ember', added: daysAgo(200), difficulty: 6, active: true, tags: 'Tech', author: 'Mapper Four', required_players: 1 },
    { name: 'CTF-BT-Fjord', added: daysAgo(400), difficulty: 9, active: true, tags: 'Hard', author: 'Mapper Five', required_players: 1, world_record: 301.004 },
    { name: 'CTF-BT-Glacier', added: daysAgo(700), difficulty: 3, active: true, author: 'Mapper Two', required_players: 1, world_record: 55.5 },
    { name: 'CTF-BT-Harbor', added: daysAgo(1000), difficulty: 7, active: true, tags: 'Long', author: 'Mapper Six', required_players: 1, world_record: 140.875 },
]

function addedSince(url: URL): Map[] {
    const since = url.searchParams.get('added_since')
    if (!since) return MAPS_LIST
    return MAPS_LIST.filter(map => new Date(map.added) >= new Date(since))
}

export const mapsFixtures: FixtureSet = {
    name: 'maps',
    routes: [
        { host: 'api', path: '/maps', reply: url => ok(addedSince(url)) },
        { host: 'api', path: '/maps/count', reply: url => ok({ count: addedSince(url).length }) },
    ],
}
