import { useEffect, useState } from 'react'
import {
    fetchAchievementDefinitions,
    fetchUserAchievements,
    type AchievementDefinition,
    type AchievementProgress,
} from '@/app/utils/api'
import {
    AchievementsShowcase,
    Segmented,
    STATUS_FILTERS,
    type AchievementStatusFilter,
} from '@/app/components/pages/achievements/AchievementsShowcase'
import { useNavState } from '@/app/components/navigation/useNavState'

interface PlayerAchievementsCardProps {
    accessToken: string | undefined
    userId: string | number
    tabsSlot?: React.ReactNode
}

export function PlayerAchievementsCard({ accessToken, userId, tabsSlot }: PlayerAchievementsCardProps) {
    const [definitions, setDefinitions] = useState<AchievementDefinition[]>([])
    const [progress, setProgress] = useState<AchievementProgress[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useNavState<AchievementStatusFilter>('achievements.statusFilter', 'all')

    useEffect(() => {
        let cancelled = false

        setLoading(true)
        setError(null)
        Promise.all([
            fetchAchievementDefinitions(accessToken ?? ''),
            fetchUserAchievements(accessToken ?? '', userId),
        ])
            .then(([defs, achievements]) => {
                if (cancelled) return
                setDefinitions(defs)
                setProgress(achievements.items)
            })
            .catch(err => {
                if (cancelled) return
                console.error('Failed to load player achievements:', err)
                setError('Failed to load achievements.')
            })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [accessToken, userId])

    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 gap-y-2 px-4 py-3 border-b border-hairline/5 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                    {tabsSlot}
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                    {STATUS_FILTERS.map(s => (
                        <Segmented
                            key={s.id}
                            active={statusFilter === s.id}
                            label={s.label}
                            onClick={() => setStatusFilter(s.id)}
                        />
                    ))}
                </div>
            </div>

            {error && (
                <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-red-400 text-xs">
                    {error}
                </div>
            )}

            <div className="p-3 space-y-2.5">
                <AchievementsShowcase
                    definitions={definitions}
                    progress={progress}
                    statusFilter={statusFilter}
                    loading={loading}
                    skeletonCount={6}
                    emptyText="No achievements to show yet."
                />
            </div>
        </div>
    )
}
