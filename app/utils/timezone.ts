import { useEffect, useState } from 'react'
import { getSynced, setSynced, subscribeSynced } from './userState'

const DISPLAY_TIMEZONE_KEY = 'utbt:displayTimezone:v1'

export const TIMEZONE_OPTIONS: string[] = (() => {
    try {
        return Intl.supportedValuesOf('timeZone')
    } catch {
        return []
    }
})()

export function browserResolvedTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    } catch {
        return 'UTC'
    }
}

export function parseApiInstant(iso: string | null | undefined): number | null {
    if (!iso) return null
    const parsed = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`).getTime()
    return Number.isNaN(parsed) ? null : parsed
}

export function formatSlotTime(iso: string, timezone: string): string {
    const at = parseApiInstant(iso)
    if (at === null) return 'Unknown time'

    const options: Intl.DateTimeFormatOptions = {
        weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }

    try {
        return new Intl.DateTimeFormat(undefined, { ...options, timeZone: timezone }).format(at)
    } catch {
        return new Intl.DateTimeFormat(undefined, options).format(at)
    }
}

export function getDisplayTimezoneOverride(): string | null {
    return getSynced<string | null>(DISPLAY_TIMEZONE_KEY, null)
}

export function getDisplayTimezone(): string {
    return getDisplayTimezoneOverride() ?? browserResolvedTimezone()
}

export function setDisplayTimezone(timezone: string | null): void {
    setSynced(DISPLAY_TIMEZONE_KEY, timezone)
}

export function useDisplayTimezone(): string {
    const [timezone, setTimezone] = useState(getDisplayTimezone)

    useEffect(() => subscribeSynced(DISPLAY_TIMEZONE_KEY, () => setTimezone(getDisplayTimezone())), [])

    return timezone
}

export function useDisplayTimezoneOverride(): [string | null, (timezone: string | null) => void] {
    const [override, setOverride] = useState(getDisplayTimezoneOverride)

    useEffect(() => subscribeSynced(DISPLAY_TIMEZONE_KEY, () => setOverride(getDisplayTimezoneOverride())), [])

    return [override, setDisplayTimezone]
}

export interface ZonedParts {
    year: number
    month: number
    day: number
    hour: number
    minute: number
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timezone: string): Intl.DateTimeFormat {
    const cached = partsFormatters.get(timezone)
    if (cached) return cached

    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }
    let formatter: Intl.DateTimeFormat
    try {
        formatter = new Intl.DateTimeFormat('en-US', { ...options, timeZone: timezone })
    } catch {
        formatter = new Intl.DateTimeFormat('en-US', options)
    }
    partsFormatters.set(timezone, formatter)
    return formatter
}

export function zonedParts(instant: number, timezone: string): ZonedParts {
    const values: Record<string, number> = {}
    for (const part of partsFormatter(timezone).formatToParts(instant)) {
        if (part.type !== 'literal') values[part.type] = Number(part.value)
    }
    return {
        year: values.year,
        month: values.month,
        day: values.day,
        hour: values.hour === 24 ? 0 : values.hour,
        minute: values.minute,
    }
}

function zoneOffsetMs(instant: number, timezone: string): number {
    const parts = zonedParts(instant, timezone)
    const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
    return wall - Math.floor(instant / 60_000) * 60_000
}

export function zonedToInstant(parts: ZonedParts, timezone: string): number {
    const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
    const firstGuess = wall - zoneOffsetMs(wall, timezone)
    return wall - zoneOffsetMs(firstGuess, timezone)
}

export function startOfNextZonedDay(instant: number, timezone: string): number {
    const parts = zonedParts(instant, timezone)
    const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1))
    return zonedToInstant({
        year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate(), hour: 0, minute: 0,
    }, timezone)
}

const pad = (value: number) => String(value).padStart(2, '0')

export function zonedDayKey(instant: number, timezone: string): string {
    const parts = zonedParts(instant, timezone)
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

export function toZonedInput(iso: string | null | undefined, timezone: string): string {
    const instant = parseApiInstant(iso)
    if (instant === null) return ''
    const parts = zonedParts(instant, timezone)
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`
}

const ZONED_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

export function fromZonedInput(value: string, timezone: string): string | null {
    const match = ZONED_INPUT.exec(value)
    if (!match) return null
    const [year, month, day, hour, minute] = match.slice(1).map(Number)
    const instant = zonedToInstant({ year, month, day, hour, minute }, timezone)
    return Number.isNaN(instant) ? null : new Date(instant).toISOString()
}

export function formatZoned(instant: number, timezone: string, options: Intl.DateTimeFormatOptions): string {
    try {
        return new Intl.DateTimeFormat(undefined, { ...options, timeZone: timezone }).format(instant)
    } catch {
        return new Intl.DateTimeFormat(undefined, options).format(instant)
    }
}
