import { describe, expect, it } from 'vitest'
import { SOUTHERN_ZONES, detectHemisphere, resolveHemisphere, type Hemisphere, type HemisphereSetting } from './hemisphere'

const SOUTHERN: string[] = [
    'Australia/Sydney',
    'Australia/Melbourne',
    'Australia/Perth',
    'Australia/Darwin',
    'Australia/Lord_Howe',
    'Pacific/Auckland',
    'Pacific/Chatham',
    'America/Sao_Paulo',
    'America/Argentina/Buenos_Aires',
    'America/Santiago',
    'America/Montevideo',
    'America/Lima',
    'America/Asuncion',
    'America/La_Paz',
    'America/Manaus',
    'Africa/Johannesburg',
    'Africa/Windhoek',
    'Africa/Maputo',
    'Africa/Harare',
    'Indian/Mauritius',
    'Pacific/Fiji',
    'Antarctica/McMurdo',
]

const EQUATORIAL_SOUTH: string[] = ['Africa/Nairobi', 'Asia/Jakarta', 'America/Guayaquil', 'Pacific/Nauru', 'Africa/Kinshasa']

const LEGACY_SOUTHERN: string[] = [
    'Australia/ACT',
    'Australia/NSW',
    'Australia/Canberra',
    'Australia/Tasmania',
    'NZ',
    'NZ-CHAT',
    'Brazil/East',
    'Brazil/West',
    'Chile/Continental',
    'America/Buenos_Aires',
    'America/Cordoba',
    'Antarctica/South_Pole',
    'Asia/Ujung_Pandang',
    'US/Samoa',
]

const NORTHERN: string[] = [
    'Europe/London',
    'Europe/Berlin',
    'Europe/Paris',
    'Europe/Moscow',
    'Atlantic/Reykjavik',
    'America/New_York',
    'America/Los_Angeles',
    'America/Toronto',
    'America/Mexico_City',
    'America/Anchorage',
    'Pacific/Honolulu',
    'Asia/Tokyo',
    'Asia/Kolkata',
    'Asia/Calcutta',
    'US/Eastern',
    'GB',
    'Etc/UTC',
    'UTC',
]

const EQUATORIAL_NORTH: string[] = [
    'Asia/Singapore',
    'Asia/Kuala_Lumpur',
    'America/Bogota',
    'America/Caracas',
    'Africa/Lagos',
    'Africa/Kampala',
    'Africa/Addis_Ababa',
    'Indian/Maldives',
    'Pacific/Chuuk',
]

const NORTHERN_REFERENCE_SAMPLE: string[] = [
    ...NORTHERN,
    ...EQUATORIAL_NORTH,
    'Africa/Asmara',
    'Africa/Asmera',
    'Africa/Djibouti',
    'Africa/Mogadishu',
    'Pacific/Pohnpei',
    'Pacific/Ponape',
    'Pacific/Truk',
    'Pacific/Yap',
    'Pacific/Midway',
    'Pacific/Majuro',
    'Pacific/Tarawa',
    'Asia/Brunei',
    'America/Cayenne',
    'America/Paramaribo',
    'America/Guyana',
    'Africa/Libreville',
    'Africa/Sao_Tome',
    'Arctic/Longyearbyen',
]

describe('detectHemisphere', () => {
    it.each(SOUTHERN)('%s counts as southern', timeZone => {
        expect(detectHemisphere(timeZone)).toBe('south')
    })

    it.each(EQUATORIAL_SOUTH)('%s, just south of the equator, counts as southern', timeZone => {
        expect(detectHemisphere(timeZone)).toBe('south')
    })

    it.each(LEGACY_SOUTHERN)('the legacy alias %s counts as southern', timeZone => {
        expect(detectHemisphere(timeZone)).toBe('south')
    })

    it.each(NORTHERN)('%s counts as northern', timeZone => {
        expect(detectHemisphere(timeZone)).toBe('north')
    })

    it.each(EQUATORIAL_NORTH)('%s, just north of the equator, counts as northern', timeZone => {
        expect(detectHemisphere(timeZone)).toBe('north')
    })

    it.each(['Mars/Olympus_Mons', 'australia/sydney', ''])('the unknown zone "%s" counts as northern', timeZone => {
        expect(detectHemisphere(timeZone)).toBe('north')
    })

    it('a missing timezone counts as northern', () => {
        expect(detectHemisphere(undefined)).toBe('north')
    })
})

describe('SOUTHERN_ZONES', () => {
    it('holds no zone from a fixed sample of northern reference locations', () => {
        expect(SOUTHERN_ZONES.filter(zone => NORTHERN_REFERENCE_SAMPLE.includes(zone))).toEqual([])
    })

    it('is sorted and free of duplicates', () => {
        expect([...new Set(SOUTHERN_ZONES)].sort()).toEqual(SOUTHERN_ZONES)
    })
})

describe('resolveHemisphere', () => {
    const CASES: Array<[string, string | undefined, HemisphereSetting, Hemisphere | null, Hemisphere]> = [
        ['auto follows a southern zone', 'Australia/Sydney', 'auto', null, 'south'],
        ['auto follows a northern zone', 'Europe/London', 'auto', null, 'north'],
        ['auto with a missing timezone', undefined, 'auto', null, 'north'],
        ['the setting beats a southern zone', 'Australia/Sydney', 'north', null, 'north'],
        ['the setting beats a northern zone', 'Europe/London', 'south', null, 'south'],
        ['the setting beats a missing timezone', undefined, 'south', null, 'south'],
        ['the preview beats the setting', 'Europe/London', 'north', 'south', 'south'],
        ['the preview beats the setting and the zone', 'Pacific/Auckland', 'south', 'north', 'north'],
        ['the preview beats detection under auto', 'Australia/Sydney', 'auto', 'north', 'north'],
    ]

    it.each(CASES)('%s', (_, timeZone, setting, preview, expected) => {
        expect(resolveHemisphere({ timeZone, setting, preview })).toBe(expected)
    })
})
