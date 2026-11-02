import { daysAgo } from '../types'

export interface Person {
    id: string
    alias: string
    flag: string
}

const FIRST = ['Amber', 'Basalt', 'Cinder', 'Delta', 'Ember', 'Fable', 'Granite', 'Harbor', 'Indigo', 'Juniper', 'Kelvin', 'Lumen']
const SECOND = ['Fox', 'Wren', 'Pike', 'Moth', 'Lynx', 'Rook', 'Vole', 'Heron', 'Otter', 'Finch']
const FLAGS = ['de', 'fr', 'gb', 'us', 'nl', 'pl', 'se', 'br', 'fi', 'cz', 'es', 'it']

export const SYNTHETIC_ID_PREFIX = '9000000000'

export function syntheticId(index: number): string {
    return `${SYNTHETIC_ID_PREFIX}${String(index).padStart(8, '0')}`
}

export const PEOPLE: readonly Person[] = Array.from({ length: FIRST.length * SECOND.length }, (_, index) => ({
    id: syntheticId(index + 1),
    alias: `${FIRST[index % FIRST.length]}${SECOND[Math.floor(index / FIRST.length) % SECOND.length]}`,
    flag: FLAGS[index % FLAGS.length],
}))

export function person(index: number): Person {
    return PEOPLE[index % PEOPLE.length]
}

export const VIEWER: Person = { id: syntheticId(0), alias: 'TestStaff', flag: 'de' }

export function documentationIp(index: number): string {
    const range = index % 2 === 0 ? '192.0.2' : '198.51.100'
    return `${range}.${(Math.floor(index / 2) % 254) + 1}`
}

export function fakeHwid(index: number): string {
    return `FAKE-HWID-${String(index).padStart(4, '0')}-0000-0000-TEST`
}

export function fakeBtpog(index: number): string {
    return `fake-btpog-${String(index).padStart(6, '0')}`
}

export function hoursAgo(hours: number): string {
    return daysAgo(hours / 24)
}

export { daysAgo }

const MAP_WORDS = ['Skyline', 'Foundry', 'Glacier', 'Canopy', 'Reactor', 'Lagoon', 'Citadel', 'Mirage', 'Quarry', 'Orbital', 'Harbour', 'Spire']

export function syntheticMap(index: number): string {
    const word = MAP_WORDS[index % MAP_WORDS.length]
    const round = Math.floor(index / MAP_WORDS.length)
    return `CTF-BT-Test${word}${round ? `-v${round + 1}` : ''}`
}

export const TITLE = {
    id: 'synthetic-title-1',
    name: 'Test Pilot',
    color: '94,234,212',
    color_r: 94,
    color_g: 234,
    color_b: 212,
    rarity: 3 as const,
}
