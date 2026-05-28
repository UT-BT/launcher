import { useState, useEffect } from 'react'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import { Slider } from '@/app/components/ui/slider'
import { submitSummaryReview, fetchMapReviews } from '@/app/utils/api'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { scoreTextColor, scoreSliderAccent } from '@/app/utils/scoreColors'
import { displayMapName } from '@/app/utils/format'

interface ReviewModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    accessToken?: string
    userId?: string | number
    mapName: string | null
    initialScores?: Partial<Record<'aesthetics' | 'learning' | 'luck' | 'difficulty' | 'overall', number>>
    onSuccess?: () => void | Promise<void>
}

type MetricKey = 'aesthetics' | 'learning' | 'luck' | 'difficulty' | 'overall'

export function ReviewModal({ open, onOpenChange, accessToken, userId, mapName, initialScores, onSuccess }: ReviewModalProps) {
    const [persistedScores, setPersistedScores] = useState<Record<string, Record<MetricKey, number>>>({})
    const [fetchedScores, setFetchedScores] = useState<Record<MetricKey, number> | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [submitted, setSubmitted] = useState(false)

    // When opened without explicit initialScores, load the user's existing
    // review for the map so it preloads everywhere the modal is used.
    useEffect(() => {
        if (!open || initialScores || !accessToken || !mapName || userId == null) {
            setFetchedScores(null)
            return
        }
        let cancelled = false
        fetchMapReviews(accessToken, mapName)
            .then(reviews => {
                if (cancelled) return
                const mine = reviews.find(r => String(r.user) === String(userId))
                setFetchedScores(mine ? {
                    aesthetics: mine.aesthetics,
                    learning: mine.learning,
                    luck: mine.luck,
                    difficulty: mine.difficulty,
                    overall: mine.overall,
                } : null)
            })
            .catch(() => { if (!cancelled) setFetchedScores(null) })
        return () => { cancelled = true }
    }, [open, mapName, accessToken, userId, initialScores])

    const defaultScores: Record<MetricKey, number> = {
        aesthetics: 5,
        learning: 5,
        luck: 5,
        difficulty: 5,
        overall: 5
    }

    const seededScores: Record<MetricKey, number> = {
        ...defaultScores,
        ...(initialScores ?? fetchedScores ?? {}),
    }

    const currentScores = mapName ? (persistedScores[mapName] || seededScores) : seededScores

    const setScore = (key: MetricKey, value: number) => {
        if (!mapName) return
        setPersistedScores(prev => ({
            ...prev,
            [mapName]: {
                ...(prev[mapName] || seededScores),
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
            setSubmitted(true)
            await onSuccess?.()
        } catch (err) {
            console.error('Failed to submit review:', err)
            setError('Failed to submit review. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        onOpenChange(false)
        setTimeout(() => setSubmitted(false), 300)
    }

    const metrics: { key: MetricKey; label: string; inverseColor?: boolean; labels: Record<number, string> }[] = [
        {
            key: 'aesthetics',
            label: 'Aesthetics',
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

    const overallMetric = metrics.find(m => m.key === 'overall')!
    const secondaryMetrics = metrics.filter(m => m.key !== 'overall')

    const getScoreColor = (key: MetricKey, value: number) =>
        scoreTextColor(value, metrics.find(m => m.key === key)?.inverseColor)

    const getSliderAccent = (key: MetricKey, value: number) =>
        scoreSliderAccent(value, metrics.find(m => m.key === key)?.inverseColor)

    return (
        <Modal
            isOpen={open}
            onClose={handleClose}
            title={submitted ? "Review Published" : (mapName ? displayMapName(mapName) : 'Review Map')}
            offsetSidebar
            maxWidth="520px"
            className="bg-[#0a0a0b]/98 border-white/5 backdrop-blur-3xl mx-auto"
            footer={null}
        >
            <div className="space-y-5">
                {submitted ? (
                    <div className="space-y-5 py-2">
                        <p className="text-white/90 text-sm leading-relaxed">
                            Your review for <span className="text-blue-300 font-semibold">{mapName ? displayMapName(mapName) : ''}</span> has been published.
                        </p>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                            Reviews help other players find good quality maps, balance the difficulty ratings, and determine what maps we put into special events.
                        </p>
                        <p className="text-white/90 font-semibold text-sm">
                            Thank you!
                        </p>
                        <Button
                            onClick={handleClose}
                            className="w-full h-10 bg-blue-500/15 border border-blue-500/40 text-blue-200 hover:bg-blue-500/25 hover:text-white hover:border-blue-500/60 hover:shadow-[0_0_20px_rgba(59,130,246,0.25)] transition-all font-semibold rounded-lg"
                        >
                            Close
                        </Button>
                    </div>
                ) : (
                    <>
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-xs font-medium">
                                {error}
                            </div>
                        )}

                        {/* Hero: Overall over map screenshot bg */}
                        <div className="relative overflow-hidden rounded-xl border border-blue-500/20">
                            {mapName && (
                                <MapThumbnail
                                    mapName={mapName}
                                    className="absolute inset-0 w-full h-full rounded-none border-0 opacity-70"
                                />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-950/70 via-black/80 to-black/90" />
                            <div className="relative p-5 space-y-4">
                                <div className="flex items-end justify-between gap-4">
                                    <div className="space-y-1 min-w-0">
                                        <div className="text-[10px] uppercase tracking-widest text-blue-300 font-bold">
                                            Your overall rating
                                        </div>
                                        <div className={cn(
                                            "text-xs font-semibold transition-colors duration-200",
                                            getScoreColor('overall', currentScores.overall)
                                        )}>
                                            {overallMetric.labels[currentScores.overall]}
                                        </div>
                                    </div>
                                    <span className={cn(
                                        "text-5xl font-bold font-mono leading-none tracking-tighter shrink-0 transition-colors",
                                        getScoreColor('overall', currentScores.overall)
                                    )}>
                                        {currentScores.overall}
                                        <span className="text-base text-muted-foreground/40 ml-0.5">/10</span>
                                    </span>
                                </div>
                                <Slider
                                    min={1}
                                    max={10}
                                    step={1}
                                    value={currentScores.overall}
                                    onChange={(e) => setScore('overall', parseInt((e.target as HTMLInputElement).value))}
                                    className={cn("h-1.5 transition-all", getSliderAccent('overall', currentScores.overall))}
                                />
                            </div>
                        </div>

                        {/* Secondary metrics */}
                        <div className="space-y-4">
                            {secondaryMetrics.map((m) => (
                                <div key={m.key} className="space-y-1.5">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <div className="space-y-0.5 min-w-0">
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                                {m.label}
                                            </div>
                                            <div className={cn(
                                                "text-[11px] font-semibold transition-colors duration-200",
                                                getScoreColor(m.key, currentScores[m.key])
                                            )}>
                                                {m.labels[currentScores[m.key]]}
                                            </div>
                                        </div>
                                        <span className={cn(
                                            "text-xl font-bold font-mono leading-none shrink-0 transition-colors",
                                            getScoreColor(m.key, currentScores[m.key])
                                        )}>
                                            {currentScores[m.key]}
                                            <span className="text-[10px] text-muted-foreground/40 ml-0.5">/10</span>
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
                            className="w-full h-10 bg-blue-500/15 border border-blue-500/40 text-blue-200 hover:bg-blue-500/25 hover:text-white hover:border-blue-500/60 hover:shadow-[0_0_20px_rgba(59,130,246,0.25)] transition-all font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                'Submit Review'
                            )}
                        </Button>
                    </>
                )}
            </div>
        </Modal>
    )
}
