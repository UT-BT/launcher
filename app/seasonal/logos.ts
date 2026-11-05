import logo from '@/app/assets/logo.webp'
import { useLogoEntry } from './SeasonProvider'
import type { EntryId } from './seasons'

const SEASONAL_LOGOS = import.meta.glob<string>('../assets/seasonal/logo-*.webp', { eager: true, import: 'default' })

export function logoFor(entry: EntryId | null): string {
    return (entry && SEASONAL_LOGOS[`../assets/seasonal/logo-${entry}.webp`]) || logo
}

export function useLogo(): string {
    return logoFor(useLogoEntry())
}
