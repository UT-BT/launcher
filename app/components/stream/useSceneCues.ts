import { useEffect, useState } from 'react'
import type { StreamSound } from '@/app/components/pages/events/pickban/stream/streamSound'
import { createSceneCuePlayer, type SceneCuePlayer } from './sceneCues'

export type SceneCues = Pick<SceneCuePlayer, 'play'>

const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const

export function useSceneCues(sound: StreamSound): SceneCues {
    const [player] = useState(() => createSceneCuePlayer(sound))
    const { muted, volume } = sound

    useEffect(() => {
        void player.preload()
        return () => player.dispose()
    }, [player])

    useEffect(() => {
        player.setSound({ muted, volume })
    }, [player, muted, volume])

    useEffect(() => {
        const unlock = () => player.unlock()
        for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock)
        return () => {
            for (const type of UNLOCK_EVENTS) window.removeEventListener(type, unlock)
        }
    }, [player])

    return player
}
