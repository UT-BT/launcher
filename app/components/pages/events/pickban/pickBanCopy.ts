import type { PickBanPresetId } from '@/app/utils/api'
import type { PickBanMatchHeading } from './pickBanView'

export const PICK_BAN_PRESET_LABELS: Record<PickBanPresetId, string> = {
    bo4_picks: 'Bo4 · four picks',
    bo3_ban_pick: 'Bo3 · bans, picks, decider',
    bo5_ban_pick: 'Bo5 · bans, picks, bans, decider',
}

export function matchSubtitle(match: PickBanMatchHeading): string {
    return [match.stageName, match.roundLabel, `Best of ${match.bestOf}`].filter(Boolean).join(' · ')
}
