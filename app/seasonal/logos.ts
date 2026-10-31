import logo from '@/app/assets/logo.webp'
import { useSeason } from './SeasonProvider'
import type { SeasonId } from './seasons'

const SEASONAL_LOGOS = import.meta.glob<string>('../assets/seasonal/logo-*.webp', { eager: true, import: 'default' })

export function logoFor(season: SeasonId | null): string {
    return (season && SEASONAL_LOGOS[`../assets/seasonal/logo-${season}.webp`]) || logo
}

export function useLogo(): string {
    return logoFor(useSeason())
}
