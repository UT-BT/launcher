import { useState } from 'react'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import { Slider } from '@/app/components/ui/slider'
import { submitSummaryReview } from '@/app/utils/api'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReviewModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    accessToken?: string
    mapName: string | null
    onSuccess?: () => void
}

type MetricKey = 'aesthetics' | 'learning' | 'luck' | 'difficulty' | 'overall'

const MapThumbnail = ({ mapName, className }: { mapName: string, className?: string }) => {
    return (
        <div className={cn("overflow-hidden bg-muted/20 border border-white/5 rounded-2xl shrink-0", className)}>
            <img
                src={`https://utbt.net/images/screenshots/${mapName}.png`}
                alt={mapName}
                className="w-full h-48 md:h-64 object-cover opacity-90"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://utbt.net/images/screenshots/default.png' }}
            />
        </div>
    )
}

export function ReviewModal({ open, onOpenChange, accessToken, mapName, onSuccess }: ReviewModalProps) {
    const [persistedScores, setPersistedScores] = useState<Record<string, Record<MetricKey, number>>>({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const defaultScores: Record<MetricKey, number> = {
        aesthetics: 5,
        learning: 5,
        luck: 5,
        difficulty: 5,
        overall: 5
    }

    const currentScores = mapName ? (persistedScores[mapName] || defaultScores) : defaultScores

    const setScore = (key: MetricKey, value: number) => {
        if (!mapName) return
        setPersistedScores(prev => ({
            ...prev,
            [mapName]: {
                ...(prev[mapName] || defaultScores),
                [key]: value
            }
        }))
    }

    const handleSubmit = async () => {
        if (!accessToken || !mapName) return
        setLoading(true)
        setError(null)
        try {
            await submitSummaryReview(accessToken, {
                map_name: mapName,
                ...currentScores
            })
            onOpenChange(false)
            onSuccess?.()
        } catch (err) {
            console.error('Failed to submit review:', err)
            setError('Failed to submit review. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const metrics: { key: MetricKey; label: string; description: string; inverseColor?: boolean; labels: Record<number, string> }[] = [
        {
            key: 'aesthetics',
            label: 'Aesthetics',
            description: 'Visual quality and theme',
            labels: {
                1: "Very poor visuals",
                2: "You didn't like the visuals of this map",
                3: "Boring visuals",
                4: "Subpar visuals",
                5: "Average visuals",
                6: "Decent visuals",
                7: "Good visuals",
                8: "Great visuals",
                9: "Amazing visuals",
                10: "You loved the visuals of this map"
            }
        },
        {
            key: 'learning',
            label: 'Learning',
            description: 'Ease of learning and flow',
            inverseColor: true,
            labels: {
                1: "Instantly mastered",
                2: "This map was easy to learn",
                3: "Very simple flow",
                4: "Straightforward learning",
                5: "Normal learning curve",
                6: "Some learning required",
                7: "Took some effort to learn",
                8: "Hard to learn",
                9: "Very complex to learn",
                10: "This map took a long time to learn"
            }
        },
        {
            key: 'luck',
            label: 'Luck',
            description: 'Impact of luck vs skill',
            inverseColor: true,
            labels: {
                1: "Absolute skill",
                2: "This map is pure skill",
                3: "Very little luck involved",
                4: "Mostly skill-based",
                5: "Some luck elements",
                6: "Moderate luck involved",
                7: "A bit too much luck",
                8: "High luck dependency",
                9: "Extremely lucky",
                10: "This map is full of luck"
            }
        },
        {
            key: 'difficulty',
            label: 'Difficulty',
            description: 'Technical map difficulty',
            inverseColor: true,
            labels: {
                1: "Trivial difficulty",
                2: "This map is very easy",
                3: "Easy map",
                4: "Low difficulty",
                5: "Standard difficulty",
                6: "Moderately difficult",
                7: "Challenging technicality",
                8: "High technical difficulty",
                9: "Extremely hard",
                10: "As hard as it gets"
            }
        },
        {
            key: 'overall',
            label: 'Overall',
            description: 'Your final personal rating',
            labels: {
                1: "Avoid this map",
                2: "You didn't enjoy this map",
                3: "Poor experience",
                4: "Below average",
                5: "It was okay",
                6: "Good experience",
                7: "Highly enjoyable",
                8: "Great map",
                9: "Excellent map",
                10: "This map is a masterpiece"
            }
        }
    ]

    const getScoreColor = (key: MetricKey, value: number) => {
        const isInverse = metrics.find(m => m.key === key)?.inverseColor
        if (isInverse) {
            if (value <= 3) return 'text-emerald-400'
            if (value <= 7) return 'text-yellow-400'
            return 'text-red-400'
        } else {
            if (value <= 3) return 'text-red-400'
            if (value <= 7) return 'text-yellow-400'
            return 'text-emerald-400'
        }
    }

    const getSliderAccent = (key: MetricKey, value: number) => {
        const isInverse = metrics.find(m => m.key === key)?.inverseColor
        if (isInverse) {
            if (value <= 3) return 'accent-emerald-500'
            if (value <= 7) return 'accent-yellow-500'
            return 'accent-red-500'
        } else {
            if (value <= 3) return 'accent-red-500'
            if (value <= 7) return 'accent-yellow-500'
            return 'accent-emerald-500'
        }
    }

    return (
        <Modal
            isOpen={open}
            onClose={() => onOpenChange(false)}
            title={mapName?.replace('CTF-BT-', '') || 'Review Map'}
            offsetSidebar
            maxWidth="672px"
            className="bg-[#0a0a0b]/98 border-white/5 backdrop-blur-3xl mx-auto"
            footer={null}
        >
            <div className="space-y-8 pb-6">
                {/* Pronounced Screenshot */}
                {mapName && <MapThumbnail mapName={mapName} className="w-full aspect-video shadow-2xl shadow-black" />}

                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold text-center">
                        {error}
                    </div>
                )}

                <div className="space-y-7 px-1">
                    {metrics.map((m) => (
                        <div key={m.key} className="space-y-3 group/metric">
                            <div className="flex justify-between items-baseline">
                                <div className="space-y-0.5">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 group-hover/metric:text-white/90 transition-colors">
                                        {m.label}
                                    </span>
                                    <p className={cn(
                                        "text-[10px] font-bold transition-colors duration-300",
                                        getScoreColor(m.key, currentScores[m.key])
                                    )}>
                                        {m.labels[currentScores[m.key]]}
                                    </p>
                                </div>
                                <span className={cn(
                                    "text-2xl font-black font-mono tracking-tighter transition-colors",
                                    getScoreColor(m.key, currentScores[m.key])
                                )}>
                                    {currentScores[m.key]}<span className="text-[10px] opacity-20 ml-0.5">/10</span>
                                </span>
                            </div>
                            <Slider
                                min={1}
                                max={10}
                                step={1}
                                value={currentScores[m.key]}
                                onChange={(e) => setScore(m.key, parseInt((e.target as HTMLInputElement).value))}
                                className={cn("h-1.5 transition-all", getSliderAccent(m.key, currentScores[m.key]))}
                            />
                        </div>
                    ))}
                </div>

                <Button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full h-14 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 text-white font-black uppercase tracking-[0.2em] rounded-2xl transition-all mt-4"
                >
                    {loading ? (
                        <Loader2 className="size-5 animate-spin" />
                    ) : (
                        'Submit Review'
                    )}
                </Button>
            </div>
        </Modal>
    )
}
