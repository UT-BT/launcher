import logo from '@/app/assets/logo.webp'
import christmasLogo from '@/app/assets/seasonal/logo-christmas.webp'
import easterLogo from '@/app/assets/seasonal/logo-easter.webp'
import halloweenLogo from '@/app/assets/seasonal/logo-halloween.webp'
import { useSeason } from './SeasonProvider'
import type { SeasonId } from './seasons'

const SEASONAL_LOGOS: Record<SeasonId, string> = {
    halloween: halloweenLogo,
    christmas: christmasLogo,
    easter: easterLogo,
}

export function logoFor(season: SeasonId | null): string {
    return season ? SEASONAL_LOGOS[season] : logo
}

export function useLogo(): string {
    return logoFor(useSeason())
}
