import introUrl from '@/app/assets/sounds/intro.mp3'
import pickUrl from '@/app/assets/sounds/pick.mp3'
import banUrl from '@/app/assets/sounds/ban.mp3'
import banDownUrl from '@/app/assets/sounds/ban-down.mp3'
import deciderUrl from '@/app/assets/sounds/decider.mp3'

export type PickBanSoundCueKind = 'intro' | 'pick' | 'ban' | 'ban_down' | 'decider'

export const SOUND_URLS: { [kind in PickBanSoundCueKind]: string } = {
    intro: introUrl,
    pick: pickUrl,
    ban: banUrl,
    ban_down: banDownUrl,
    decider: deciderUrl,
}

export const SOUND_HIT_MS: { [kind in PickBanSoundCueKind]: number } = {
    intro: 620,
    pick: 320,
    ban: 320,
    ban_down: 160,
    decider: 1040,
}
