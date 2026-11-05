import logo from '@/app/assets/logo.webp'
import { useLogoEntry } from './SeasonProvider'
import { ENTRIES, type Entry, type EntryId } from './seasons'

const SEASONAL_LOGOS = import.meta.glob<string>('../assets/seasonal/logo-*.webp', { eager: true, import: 'default' })
const REGISTRY: readonly Entry[] = ENTRIES

function logoFile(entry: EntryId): EntryId {
    return REGISTRY.find(candidate => candidate.id === entry)?.logo ?? entry
}

export function logoFor(entry: EntryId | null): string {
    return (entry && SEASONAL_LOGOS[`../assets/seasonal/logo-${logoFile(entry)}.webp`]) || logo
}

export function useLogo(): string {
    return logoFor(useLogoEntry())
}
