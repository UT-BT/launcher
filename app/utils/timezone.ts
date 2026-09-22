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
