import { UserProfile, fetchSummary, Summary } from '@/app/utils/api'
import { useMemo, useState, useEffect } from 'react'
import { Trophy, TrendingUp, Zap, ChevronRight, MessageSquare, Plus, Activity, AlertTriangle, RefreshCw, Flag, Download, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { Tooltip } from '@/app/components/ui/tooltip'
import { HistoryModal } from '@/app/components/modals/HistoryModal'
import { ReviewModal } from '@/app/components/modals/ReviewModal'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'

import worldRecordIcon from '@/app/assets/world_record.png'
import championIcon from '@/app/assets/champion.png'
import goldIcon from '@/app/assets/gold.png'
import silverIcon from '@/app/assets/silver.png'
import bronzeIcon from '@/app/assets/bronze.png'
import certifiedIcon from '@/app/assets/certified.png'
import casualIcon from '@/app/assets/casual.png'

interface HomeProps {
    userProfile?: UserProfile
}

const formatSeconds = (seconds: number) => {
    return `${(seconds / 3600).toFixed(1)}h`
}

const formatCapTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)

    const msStr = ms.toString().padStart(3, '0')
    const secsStr = secs.toString().padStart(2, '0')
    const minsStr = minutes.toString().padStart(2, '0')

    if (hours > 0) {
        return `${hours}:${minsStr}:${secsStr}.${msStr}`
    }
    return `${minsStr}:${secsStr}.${msStr}`
}

const getMedalIcon = (medal: string) => {
    switch (medal?.toLowerCase()) {
        case 'world record': return worldRecordIcon
        case 'champion medal': return championIcon
        case 'gold medal': return goldIcon
        case 'silver medal': return silverIcon
        case 'bronze medal': return bronzeIcon
        case 'certified': return certifiedIcon
        case 'casual': return casualIcon
        default: return null
    }
}

const MapThumbnail = ({ mapName, className }: { mapName: string, className?: string }) => {
    return (
        <div className={cn("overflow-hidden bg-muted/20 border border-white/5 rounded-lg shrink-0", className)}>
            <img
                src={`https://utbt.net/images/screenshots/${mapName}.png`}
                alt={mapName}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://utbt.net/images/screenshots/default.png' }}
            />
        </div>
    )
}

export function Home({ userProfile }: HomeProps) {
    const username = userProfile?.alias || userProfile?.username || 'Player'
    const [summary, setSummary] = useState<Summary | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [reviewOpen, setReviewOpen] = useState(false)
    const [activeReviewMap, setActiveReviewMap] = useState<string | null>(null)
    const [dismissedPatch, setDismissedPatch] = useState<string | null>(localStorage.getItem('dismissed-patch'))
    const [installedPatch, setInstalledPatch] = useState<string | null>(null)

    const handleDismissPatch = (tag: string) => {
        setDismissedPatch(tag)
        localStorage.setItem('dismissed-patch', tag)
    }

    const latestPatch = summary?.latestPatch
    const lastLoginStr = userProfile?.latest_activity?.created_at

    const showPatchBanner = useMemo(() => {
        if (!latestPatch || !lastLoginStr) return false
        if (dismissedPatch === latestPatch.tag) return false
        if (installedPatch === latestPatch.tag) return false

        try {
            const patchDate = new Date(latestPatch.added)
            const loginDate = new Date(lastLoginStr)
            return patchDate > loginDate
        } catch (e) {
            return false
        }
    }, [latestPatch, lastLoginStr, dismissedPatch, installedPatch])

    const loadData = async () => {
        if (!userProfile?.accessToken) return
        setLoading(true)
        setError(null)
        try {
            const [summaryData, currentPatch] = await Promise.all([
                fetchSummary(userProfile.accessToken),
                window.conveyor.app.getInstalledPatch()
            ])
            setSummary(summaryData)
            setInstalledPatch(currentPatch?.tag || null)
        } catch (err) {
            console.error('Failed to load summary:', err)
            setError('Failed to load personalized feed.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (userProfile?.accessToken) {
            loadData()
        } else {
            setLoading(false)
        }
    }, [userProfile?.accessToken])

    const lastSeenDate = useMemo(() => {
        if (!userProfile?.latest_activity?.created_at) return 'First time? Welcome! 🐰'
        try {
            const date = new Date(userProfile.latest_activity.created_at)
            return new Intl.DateTimeFormat('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', year: 'numeric', minute: '2-digit'
            }).format(date)
        } catch (e) { return 'Unknown' }
    }, [userProfile?.latest_activity?.created_at])

    const getGreeting = () => {
        const hours = new Date().getHours()
        if (hours < 12) return 'Good morning'
        if (hours < 18) return 'Good afternoon'
        return 'Good evening'
    }

    if (!userProfile) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center space-y-4">
                    <Activity className="size-12 text-muted-foreground/20 mx-auto" />
                    <p className="text-muted-foreground font-medium">Please log in to view your personalized feed.</p>
                </div>
            </div>
        )
    }

    if (loading && !summary) {
        return (
            <div className="max-w-[1400px] mx-auto space-y-12 pb-20 pt-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pt-4">
                    <div className="space-y-1 animate-pulse">
                        <div className="h-10 w-64 bg-white/5 rounded-lg" />
                        <div className="h-4 w-32 bg-white/5 rounded-lg opacity-50" />
                    </div>
                    <div className="h-10 w-48 bg-white/5 rounded-full animate-pulse" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-1 h-32 bg-white/5 rounded-2xl animate-pulse" />
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
                    <div className="col-span-7 h-[500px] bg-white/5 rounded-2xl animate-pulse" />
                    <div className="col-span-5 h-[500px] bg-white/5 rounded-2xl animate-pulse" />
                </div>
            </div>
        )
    }

    // Fallback if data failed, but we still want to show something or retry
    if (error && !summary) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center space-y-4">
                    <AlertTriangle className="size-12 text-red-500/50 mx-auto" />
                    <p className="text-red-400 font-medium">{error}</p>
                    <Button onClick={loadData} variant="outline" className="gap-2">
                        <RefreshCw className="size-4" /> Try Again
                    </Button>
                </div>
            </div>
        )
    }

    const data = summary || {
        playtime: {
            weekly: 0, weeklyTop: null,
            monthly: 0, monthlyTop: null,
            yearly: 0, yearlyTop: null
        },
        global: { newMaps: 0, newRecords: 0 },
        achievements: [],
        pendingReviews: []
    }

    return (
        <div className="max-w-[1400px] mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-0 duration-500 pb-20">
            {showPatchBanner && latestPatch && (
                <div className="mt-6 animate-in slide-in-from-top-4 duration-500">
                    <div className="relative group overflow-hidden bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl backdrop-blur-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                        <div className="flex items-center gap-5 relative z-10">
                            <div className="size-14 rounded-2xl bg-blue-500/20 flex items-center justify-center shadow-lg shadow-blue-500/10 group-hover:scale-110 transition-transform duration-500">
                                <Download className="size-7 text-blue-400" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-white/90 tracking-tight">
                                    Unreal Tournament <span className="text-blue-400">{latestPatch.tag}</span> is now available
                                </h3>
                                <p className="text-sm text-muted-foreground font-medium">
                                    Install it now to get the latest features and fixes. Release notes are available <a href={latestPatch.release_notes_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">here</a>.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 relative z-10">
                            <Button
                                onClick={() => window.dispatchEvent(new CustomEvent('open-settings', { detail: { section: 'game-installation' } }))}
                                className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-[10px] px-8 py-6 rounded-xl shadow-xl shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
                            >
                                Install
                            </Button>
                            <button
                                onClick={() => handleDismissPatch(latestPatch.tag)}
                                className="size-12 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground hover:bg-white/10 hover:text-white transition-all"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pt-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-4xl font-black tracking-tight text-white/90">
                            {getGreeting()}, <span className="text-blue-400">{username}</span>
                        </h1>
                    </div>
                    <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">
                        Last login: {lastSeenDate}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Tooltip content="Since last login" side="bottom">
                        <div className="flex items-center bg-white/[0.03] border border-white/5 rounded-full px-4 py-1.5 gap-6 backdrop-blur-sm hover:bg-white/[0.05] transition-colors cursor-help">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">New Maps</span>
                                <span className="text-sm font-black text-blue-400">{data.global.newMaps}</span>
                            </div>
                            <div className="w-px h-3 bg-white/10" />
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">New Records</span>
                                <span className="text-sm font-black text-orange-400">{data.global.newRecords}</span>
                            </div>
                        </div>
                    </Tooltip>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-1 bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden backdrop-blur-xl group">
                {[
                    { label: 'Last 7 Days', value: formatSeconds(data.playtime.weekly), top: data.playtime.weeklyTop, icon: Zap, color: 'text-emerald-500' },
                    { label: 'Last 30 Days', value: formatSeconds(data.playtime.monthly), top: data.playtime.monthlyTop, icon: TrendingUp, color: 'text-blue-500' },
                    { label: 'Last 365 Days', value: formatSeconds(data.playtime.yearly), top: data.playtime.yearlyTop, icon: Trophy, color: 'text-purple-500' }
                ].map((stat, i) => (
                    <div key={i} className="relative px-8 py-6 flex flex-col gap-0.5 hover:bg-white/[0.03] transition-colors overflow-hidden group/stat">
                        <div className={cn("absolute -right-4 -bottom-4 size-24 opacity-[0.03] transition-transform duration-700 group-hover/stat:scale-125 group-hover/stat:rotate-12", stat.color)}>
                            <stat.icon className="w-full h-full" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground group-hover/stat:text-white/60 transition-colors">
                            {stat.label}
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-white/90 tracking-tighter">{stat.value}</span>
                            {stat.top !== null && (
                                <span className="text-[10px] font-bold text-blue-400 opacity-60 group-hover/stat:opacity-100 transition-opacity">
                                    (Top {stat.top}%)
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
                <div className="xl:col-span-7 space-y-6">
                    <div className="flex items-center justify-between px-3">
                        <h2 className="text-lg font-black uppercase tracking-widest text-white/80">Recent Caps</h2>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setHistoryOpen(true)}
                            className="text-[10px] font-bold text-muted-foreground hover:text-white uppercase tracking-widest gap-2 bg-white/5 border border-white/5 shadow-lg shadow-black/20"
                        >
                            See More <ChevronRight className="size-3" />
                        </Button>
                    </div>

                    <div className="space-y-2">
                        {data.achievements.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 rounded-3xl bg-white/[0.02] border border-dashed border-white/5 gap-3">
                                <div className="size-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                                    <Flag className="size-6 text-blue-400" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-white/90">No Recent Caps</p>
                                    <p className="text-[10px] text-muted-foreground/50 font-medium">Head to a server and start capping!</p>
                                </div>
                            </div>
                        ) : (
                            data.achievements.map((ach) => {
                                const medalIcon = getMedalIcon(ach.medal)
                                const timeVal = Number(ach.time)
                                const timeStr = !isNaN(timeVal) ? formatCapTime(timeVal) : ach.time

                                return (
                                    <div key={ach.id} className="group flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.03] border border-transparent hover:border-white/5 transition-all">
                                        <MapThumbnail mapName={ach.mapName} className="w-24 aspect-video rounded-md" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-white/90 truncate">{ach.mapName.replace('CTF-BT-', '')}</h3>
                                                {medalIcon && (
                                                    <img src={medalIcon} alt={ach.medal} className="h-5 w-auto object-contain" title={ach.medal} />
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest">
                                                    Capped {ach.timeAgo}
                                                </span>
                                                <div className="size-1 rounded-full bg-white/5" />
                                                <PlayerInfo alias={ach.author} size="sm" className="text-[10px] text-muted-foreground/40" />
                                                <div className="size-1 rounded-full bg-white/5" />
                                                <span className="text-[10px] font-bold text-orange-400/60 uppercase tracking-widest">Difficulty {ach.difficulty}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-xl font-black font-mono text-white/90 tracking-tighter">
                                                {timeStr}</span>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                <div className="xl:col-span-5 space-y-6">
                    <div className="flex items-center px-3">
                        <h2 className="text-lg font-black uppercase tracking-widest text-white/80">Unreviewed Maps</h2>
                    </div>

                    <div className="space-y-4">
                        {data.pendingReviews.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 rounded-3xl bg-white/[0.02] border border-dashed border-white/5 gap-3">
                                <div className="size-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                                    <MessageSquare className="size-6 text-orange-400" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-white/90">All Caught Up!</p>
                                    <p className="text-[10px] text-muted-foreground/50 font-medium">No pending map reviews at the moment.</p>
                                </div>
                            </div>
                        ) : (
                            data.pendingReviews.map((rev) => (
                                <div key={rev.id} className="group flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.03] border border-transparent hover:border-white/5 transition-all">
                                    <MapThumbnail mapName={rev.mapName} className="w-24 aspect-video rounded-md" />
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-white/90 truncate group-hover:text-orange-400 transition-colors">
                                            {rev.mapName.replace('CTF-BT-', '')}
                                        </h3>
                                        <p className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest mt-0.5">
                                            Capped {rev.timeAgo}
                                        </p>
                                    </div>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => {
                                            setActiveReviewMap(rev.mapName)
                                            setReviewOpen(true)
                                        }}
                                        className="size-10 rounded-xl bg-white/5 hover:bg-orange-500 hover:text-white transition-all shrink-0"
                                    >
                                        <Plus className="size-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <HistoryModal
                open={historyOpen}
                onOpenChange={setHistoryOpen}
                accessToken={userProfile.accessToken}
            />

            <ReviewModal
                open={reviewOpen}
                onOpenChange={setReviewOpen}
                accessToken={userProfile.accessToken}
                mapName={activeReviewMap}
                onSuccess={loadData}
            />
        </div>
    )
}