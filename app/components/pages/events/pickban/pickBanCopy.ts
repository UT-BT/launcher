import type { PickBanMatchHeading } from './pickBanView'

export function matchSubtitle(match: PickBanMatchHeading): string {
    return [match.stageName, match.roundLabel, `Best of ${match.bestOf}`].filter(Boolean).join(' · ')
}
