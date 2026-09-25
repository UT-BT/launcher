import cinematicIntroUrl from '@/app/assets/sounds/cinematic/intro.mp3'
import cinematicPickUrl from '@/app/assets/sounds/cinematic/pick.mp3'
import cinematicBanUrl from '@/app/assets/sounds/cinematic/ban.mp3'
import cinematicBanDownUrl from '@/app/assets/sounds/cinematic/ban-down.mp3'
import cinematicDeciderUrl from '@/app/assets/sounds/cinematic/decider.mp3'
import cleanIntroUrl from '@/app/assets/sounds/clean/intro.mp3'
import cleanPickUrl from '@/app/assets/sounds/clean/pick.mp3'
import cleanBanUrl from '@/app/assets/sounds/clean/ban.mp3'
import cleanBanDownUrl from '@/app/assets/sounds/clean/ban-down.mp3'

export type PickBanSoundCueKind = 'intro' | 'pick' | 'ban' | 'ban_down' | 'decider'

export type PickBanSoundPack = 'cinematic' | 'clean'

export const SOUND_PACK_IDS: readonly PickBanSoundPack[] = ['cinematic', 'clean']

export const SOUND_PACKS: { [pack in PickBanSoundPack]: { [kind in PickBanSoundCueKind]: string } } = {
    cinematic: {
        intro: cinematicIntroUrl,
        pick: cinematicPickUrl,
        ban: cinematicBanUrl,
        ban_down: cinematicBanDownUrl,
        decider: cinematicDeciderUrl,
    },
    clean: {
        intro: cleanIntroUrl,
        pick: cleanPickUrl,
        ban: cleanBanUrl,
        ban_down: cleanBanDownUrl,
        decider: cinematicDeciderUrl,
    },
}

export const SOUND_HIT_MS: { [kind in PickBanSoundCueKind]: number } = {
    intro: 620,
    pick: 320,
    ban: 320,
    ban_down: 160,
    decider: 1040,
}
