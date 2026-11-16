import { useEffect, useState } from 'react'
import { fetchCelebration, type Celebration } from '@/app/utils/api'
import { userStateSettled } from '@/app/utils/userState'
import { BROADCAST_FONTS } from '@/app/components/broadcast/broadcastFonts'
import { hasSeenCelebration, isAutomatedBrowser, markCelebrationSeen } from './celebrationSeen'
import { ChampionsCelebration } from './ChampionsCelebration'

const FONT_WAIT_MS = 1500

const SYNC_WAIT_MS = 4000

function atMost(work: Promise<unknown>, ms: number): Promise<unknown> {
    return Promise.race([work, new Promise(resolve => window.setTimeout(resolve, ms))])
}

function fontsReady(): Promise<unknown> {
    const fonts = typeof document === 'undefined' ? undefined : document.fonts
    if (!fonts) return Promise.resolve()
    return atMost(Promise.all(BROADCAST_FONTS.map(font => fonts.load(font).catch(() => []))), FONT_WAIT_MS)
}

export function CelebrationHost({ onOpenStats }: { onOpenStats: (slug: string) => void }) {
    const [celebration, setCelebration] = useState<Celebration | null>(null)

    useEffect(() => {
        if (isAutomatedBrowser()) return
        const controller = new AbortController()
        const accountSynced = atMost(userStateSettled().catch(() => undefined), SYNC_WAIT_MS)
        fetchCelebration(controller.signal)
            .then(async found => {
                if (!found || found.podium.length === 0) return
                await accountSynced
                if (controller.signal.aborted || hasSeenCelebration(found.slug)) return
                await fontsReady()
                if (controller.signal.aborted) return
                markCelebrationSeen(found.slug)
                setCelebration(found)
            })
            .catch(() => undefined)
        return () => controller.abort()
    }, [])

    if (!celebration) return null

    return (
        <ChampionsCelebration
            celebration={celebration}
            onClose={() => setCelebration(null)}
            onOpenStats={() => onOpenStats(celebration.slug)}
        />
    )
}
