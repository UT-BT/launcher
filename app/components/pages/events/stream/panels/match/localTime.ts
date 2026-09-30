import { toZonedInput } from '@/app/utils/timezone'

export type LocalTimeResult =
    | { status: 'ok'; iso: string; ambiguous: boolean }
    | { status: 'gap' }
    | { status: 'invalid' }

const DAY_MS = 24 * 60 * 60 * 1000
const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

const wallClockFormats = new Map<string, Intl.DateTimeFormat>()

function wallClockFormat(timeZone: string): Intl.DateTimeFormat {
    let format = wallClockFormats.get(timeZone)
    if (!format) {
        format = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        })
        wallClockFormats.set(timeZone, format)
    }
    return format
}

function offsetMs(timeZone: string, at: number): number {
    const parts: Record<string, number> = {}
    for (const part of wallClockFormat(timeZone).formatToParts(at)) {
        if (part.type !== 'literal') parts[part.type] = Number(part.value)
    }
    const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
    return wall - Math.floor(at / 1000) * 1000
}

function isoText(at: number): string {
    return new Date(at).toISOString().replace('.000Z', 'Z')
}

export function utcFromLocalInput(value: string, timeZone: string): LocalTimeResult {
    const match = LOCAL_INPUT.exec(value.trim())
    if (!match) return { status: 'invalid' }
    const [, year, month, day, hour, minute] = match.map(Number)
    const wall = Date.UTC(year, month - 1, day, hour, minute)
    const check = new Date(wall)
    if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) return { status: 'invalid' }

    const offsets = new Set([offsetMs(timeZone, wall - DAY_MS), offsetMs(timeZone, wall + DAY_MS)])
    const instants = [...offsets]
        .map(offset => wall - offset)
        .filter(instant => wall - instant === offsetMs(timeZone, instant))
        .sort((a, b) => a - b)

    if (instants.length === 0) return { status: 'gap' }
    return { status: 'ok', iso: isoText(instants[0]), ambiguous: instants.length > 1 }
}

export function localInputFromInstant(iso: string | null, timeZone: string): string {
    return toZonedInput(iso, timeZone)
}

function zoneAbbreviation(timeZone: string, at: number): string | null {
    for (const locale of ['en-US', 'en-GB']) {
        const name = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'short' })
            .formatToParts(at)
            .find(part => part.type === 'timeZoneName')?.value
        if (name && !/^(GMT|UTC)[+\-\d]/.test(name)) return name
    }
    return null
}

export function timeZoneLabel(timeZone: string, at: number): string {
    const abbreviation = zoneAbbreviation(timeZone, at)
    return abbreviation && abbreviation !== timeZone ? `${timeZone} (${abbreviation})` : timeZone
}
