import { useEffect, useState } from 'react'
import { fetchCelebration, type Celebration } from '@/app/utils/api'
import { hasSeenCelebration, isAutomatedBrowser, markCelebrationSeen } from './celebrationSeen'
import { ChampionsCelebration } from './ChampionsCelebration'

export function CelebrationHost({ onOpenStats }: { onOpenStats: (slug: string) => void }) {
    const [celebration, setCelebration] = useState<Celebration | null>(null)

    useEffect(() => {
        if (isAutomatedBrowser()) return
        const controller = new AbortController()
        fetchCelebration(controller.signal)
            .then(found => {
                if (!found || found.podium.length === 0 || hasSeenCelebration(found.slug)) return
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
