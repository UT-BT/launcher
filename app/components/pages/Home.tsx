import { UserProfile, fetchMaps, fetchMapsCount, Map as MapData, Record as RecordData, fetchRecords, fetchRecordsCount } from '@/app/utils/api'
import { Activity, ChevronLeft, ChevronRight, Star, TrendingUp, User as UserIcon, Loader2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/lib/utils'
import { useState, useEffect, useMemo } from 'react'

interface HomeProps {
    userProfile?: UserProfile
}

const communityActivities = [
    {
        id: 1,
        user: 'huskywusky',
        action: 'played on',
        target: 'CTF-BT-Pharoh][BE',
        value: '102:46.00',
        time: '3d ago',
        type: 'Playtime'
    },
    {
        id: 2,
        user: 'Diego.px4',
        action: 'played on',
        target: 'CTF-BT-andACTION-dbl',
        value: '4:42.00',
        time: '3d ago',
        type: 'Playtime'
    },
    {
        id: 3,
        user: 'huskywusky',
        action: 'played on',
        target: 'CTF-BT-Apocalypto-v2',
        value: '1:05.00',
        time: '3d ago',
        type: 'Playtime'
    },
    {
        id: 4,
        user: 'utbt_spectator',
        subtitle: '(live on twitch)',
        action: 'played on',
        target: 'CTF-BT-Atlantis-RE',
        value: '45:12.00',
        time: '1d ago',
        type: 'Playtime'
    },
    {
        id: 5,
        user: '-dsm.Naru-',
        action: 'played on',
        target: 'CTF-BT-Atlantis-RE',
        value: '257:32.00',
        time: '3d ago',
        type: 'Playtime'
    }
]

const yourActivities = [
    {
        id: 1,
        type: 'pb',
        title: 'Personal Best',
        target: 'CTF-BT-Practice',
        value: '1:20.55',
        diff: '-2.5s',
        time: 'Yesterday',
        icon: TrendingUp,
        iconColor: 'bg-green-500/10 text-green-500'
    },
    {
        id: 2,
        type: 'rating',
        title: 'You Rated',
        target: 'CTF-BT-OldSkool',
        rating: 4,
        time: '2 days ago',
        icon: Star,
        iconColor: 'bg-purple-500/10 text-purple-500'
    }
]

const tabs = ['All', 'Maps', 'Records', 'Titles', 'Playtime']
const pageSizeOptions = [5, 10, 15, 20]

export function Home({ userProfile }: HomeProps) {
    const [activeTab, setActiveTab] = useState('All')
    const [pageSize, setPageSize] = useState(5)
    const [currentPage, setCurrentPage] = useState(1)
    const [maps, setMaps] = useState<MapData[]>([])
    const [mapsCount, setMapsCount] = useState(0)
    const [newMapsCount, setNewMapsCount] = useState(0)
    const [records, setRecords] = useState<RecordData[]>([])
    const [recordsCount, setRecordsCount] = useState(0)
    const [newRecordsCount, setNewRecordsCount] = useState(0)
    const [isLoadingMaps, setIsLoadingMaps] = useState(false)
    const [isLoadingRecords, setIsLoadingRecords] = useState(false)

    const username = userProfile?.alias || userProfile?.username || 'Player'

    useEffect(() => {
        if (userProfile?.accessToken && userProfile?.latest_activity?.created_at) {
            Promise.all([
                fetchMapsCount(userProfile.accessToken, userProfile.latest_activity.created_at),
                fetchRecordsCount(userProfile.accessToken, userProfile.latest_activity.created_at)
            ]).then(([maps, recordsCount]) => {
                setNewMapsCount(maps)
                setNewRecordsCount(recordsCount)
            }).catch(err => console.error('Failed to fetch new counts:', err))
        }
    }, [userProfile?.accessToken, userProfile?.latest_activity?.created_at])

    useEffect(() => {
        if (activeTab === 'Maps') {
            setNewMapsCount(0)
            if (userProfile?.accessToken) {
                loadMaps()
            }
        } else if (activeTab === 'Records') {
            setNewRecordsCount(0)
            if (userProfile?.accessToken) {
                loadRecords()
            }
        }
    }, [activeTab, userProfile?.accessToken, pageSize, currentPage])

    const loadMaps = async () => {
        if (!userProfile?.accessToken) return

        setIsLoadingMaps(true)
        try {
            const [mapsData, count] = await Promise.all([
                fetchMaps(userProfile.accessToken, pageSize, (currentPage - 1) * pageSize, 'newest'),
                fetchMapsCount(userProfile.accessToken)
            ])
            setMaps(mapsData)
            setMapsCount(count)
        } catch (error) {
            console.error('Failed to load maps:', error)
        } finally {
            setIsLoadingMaps(false)
        }
    }

    const loadRecords = async () => {
        if (!userProfile?.accessToken) return

        setIsLoadingRecords(true)
        try {
            const [recordsData, count] = await Promise.all([
                fetchRecords(userProfile.accessToken, pageSize, (currentPage - 1) * pageSize, 'newest'),
                fetchRecordsCount(userProfile.accessToken)
            ])
            setRecords(recordsData)
            setRecordsCount(count)
        } catch (error) {
            console.error('Failed to load records:', error)
        } finally {
            setIsLoadingRecords(false)
        }
    }

    const totalPages = useMemo(() => {
        if (activeTab === 'Maps') return Math.ceil(mapsCount / pageSize)
        if (activeTab === 'Records') return Math.ceil(recordsCount / pageSize)
        return 1
    }, [activeTab, mapsCount, recordsCount, pageSize])

    const handlePrevPage = () => setCurrentPage(prev => Math.max(1, prev - 1))
    const handleNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1))

    const lastSeenTime = useMemo(() => {
        if (!userProfile?.latest_activity?.created_at) return null
        const date = new Date(userProfile.latest_activity.created_at)
        return isNaN(date.getTime()) ? null : date.getTime()
    }, [userProfile?.latest_activity?.created_at])

    const lastSeenDate = useMemo(() => {
        if (!userProfile?.latest_activity?.created_at) return 'Never! Welcome to UTBT 💕'

        try {
            const date = new Date(userProfile.latest_activity.created_at)
            if (isNaN(date.getTime())) return 'Unknown'
            return new Intl.DateTimeFormat('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }).format(date)
        } catch (e) {
            console.error('Failed to format last seen date:', e)
            return 'Unknown'
        }
    }, [userProfile?.latest_activity?.created_at])

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Greeting */}
            <div className="space-y-1">
                <h1 className="text-4xl font-bold tracking-tight text-white">
                    Good evening, <span className="text-neutral-400">{username}</span>
                </h1>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-sm"><b>Last seen:</b> {lastSeenDate}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Community Section */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <Activity className="size-5 text-foreground" />
                            <h2 className="text-xl font-bold">UTBT Activity</h2>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex bg-white/5 p-1 rounded-full border border-white/5 w-fit">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => {
                                            setActiveTab(tab)
                                            setCurrentPage(1)
                                        }}
                                        className={cn(
                                            "px-3 py-1 rounded-full text-xs font-medium transition-all relative",
                                            activeTab === tab
                                                ? "bg-white text-black shadow-lg"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {tab}
                                        {tab === 'Maps' && newMapsCount > 0 && (
                                            <span className="absolute -top-1.5 -right-1 text-white bg-red-600 text-[10px] font-black rounded-full h-4 min-w-[1rem] px-1 flex items-center justify-center border border-[#09090b] shadow-[0_0_10px_rgba(220,38,38,0.5)] animate-in zoom-in duration-300">
                                                {newMapsCount > 99 ? '99+' : newMapsCount}
                                            </span>
                                        )}
                                        {tab === 'Records' && newRecordsCount > 0 && (
                                            <span className="absolute -top-1.5 -right-1 text-white bg-red-600 text-[10px] font-black rounded-full h-4 min-w-[1rem] px-1 flex items-center justify-center border border-[#09090b] shadow-[0_0_10px_rgba(220,38,38,0.5)] animate-in zoom-in duration-300">
                                                {newRecordsCount > 99 ? '99+' : newRecordsCount}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-lg border border-white/5">
                                    <span className="text-[10px] font-bold text-muted-foreground px-1.5 uppercase tracking-wider">Show</span>
                                    <div className="flex gap-0.5">
                                        {pageSizeOptions.map((size) => (
                                            <button
                                                key={size}
                                                onClick={() => {
                                                    setPageSize(size)
                                                    setCurrentPage(1)
                                                }}
                                                className={cn(
                                                    "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
                                                    pageSize === size
                                                        ? "bg-white/10 text-white"
                                                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                                )}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-6 rounded-full hover:bg-white/10"
                                        onClick={handlePrevPage}
                                        disabled={currentPage === 1}
                                    >
                                        <ChevronLeft className="size-4" />
                                    </Button>
                                    <span className="text-xs font-medium w-4 text-center">{currentPage}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-6 rounded-full hover:bg-white/10"
                                        onClick={handleNextPage}
                                        disabled={currentPage === totalPages || totalPages === 0}
                                    >
                                        <ChevronRight className="size-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 relative min-h-[300px]">
                        {(isLoadingMaps || isLoadingRecords) ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-sm z-10 rounded-xl">
                                <Loader2 className="size-8 animate-spin text-primary" />
                            </div>
                        ) : null}

                        {activeTab === 'Maps' ? (
                            <>
                                {maps.map((map) => (
                                    <div
                                        key={map.name}
                                        className="group relative bg-card/30 backdrop-blur-sm border border-white/5 rounded-xl p-3 flex items-center gap-4 transition-all hover:bg-card/50 hover:border-white/10"
                                    >
                                        <div className="size-16 rounded-lg bg-white/5 overflow-hidden flex-shrink-0 border border-white/5 relative">
                                            <img
                                                src={`https://utbt.net/images/screenshots/${map.name}.png`}
                                                alt={map.name}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'https://utbt.net/images/screenshots/default.png'
                                                }}
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-baseline gap-1.5 min-w-0">
                                                    <span className="font-bold text-foreground text-sm truncate">
                                                        {map.name}
                                                    </span>
                                                    {lastSeenTime && new Date(map.added).getTime() > lastSeenTime && (
                                                        <span className="shrink-0 bg-red-500/20 text-red-500 text-[9px] font-black px-1.5 py-0.5 rounded border border-red-500/30 animate-pulse uppercase tracking-tight shadow-[0_0_8px_rgba(239,68,68,0.2)]">
                                                            New
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                                                    {new Date(map.added).toUTCString()}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="font-semibold text-foreground text-xs truncate">
                                                    {map.author}
                                                </span>
                                                <span className={cn(
                                                    "text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider",
                                                    map.difficulty <= 3 ? "text-green-400 bg-green-400/10 border-green-400/20" :
                                                        map.difficulty <= 7 ? "text-orange-400 bg-orange-400/10 border-orange-400/20" :
                                                            "text-red-400 bg-red-400/10 border-red-400/20"
                                                )}>
                                                    Difficulty {map.difficulty}
                                                </span>
                                                {map.tags?.split(',').map(tag => (
                                                    <span key={tag} className="text-[9px] bg-white/5 px-2 py-0.5 rounded border border-white/5 text-muted-foreground uppercase tracking-wider font-bold">
                                                        {tag.trim()}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {maps.length === 0 && !isLoadingMaps && (
                                    <div className="text-center py-12 text-muted-foreground">
                                        No maps found.
                                    </div>
                                )}
                            </>
                        ) : activeTab === 'Records' ? (
                            <>
                                {records.map((record) => (
                                    <div
                                        key={record.cap_id}
                                        className="group relative bg-card/30 backdrop-blur-sm border border-white/5 rounded-xl p-3 flex items-center gap-4 transition-all hover:bg-card/50 hover:border-white/10"
                                    >
                                        <div className="size-16 rounded-lg bg-white/5 overflow-hidden flex-shrink-0 border border-white/5 relative">
                                            <img
                                                src={`https://utbt.net/images/screenshots/${record.map}.png`}
                                                alt={record.map}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'https://utbt.net/images/screenshots/default.png'
                                                }}
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-baseline gap-1.5 min-w-0">
                                                    <span className="font-bold text-foreground text-sm truncate">
                                                        {record.map}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">by</span>
                                                    <span
                                                        className="font-bold text-sm truncate"
                                                        style={record.color_r !== undefined ? { color: `rgb(${record.color_r}, ${record.color_g}, ${record.color_b})` } : {}}
                                                    >
                                                        {record.alias}
                                                    </span>
                                                    {lastSeenTime && new Date(record.added).getTime() > lastSeenTime && (
                                                        <span className="shrink-0 bg-red-500/20 text-red-500 text-[9px] font-black px-1.5 py-0.5 rounded border border-red-500/30 animate-pulse uppercase tracking-tight shadow-[0_0_8px_rgba(239,68,68,0.2)]">
                                                            New
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                                                    {new Date(record.added).toUTCString()}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                                                    <span className="font-mono text-green-400 text-[11px] font-black">
                                                        {(() => {
                                                            const totalMs = Math.floor(record.cap_time_seconds * 100);
                                                            const minutes = Math.floor(totalMs / 6000);
                                                            const seconds = Math.floor((totalMs % 6000) / 100);
                                                            const centiseconds = totalMs % 100;
                                                            return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
                                                        })()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {records.length === 0 && !isLoadingRecords && (
                                    <div className="text-center py-12 text-muted-foreground">
                                        No records found.
                                    </div>
                                )}
                            </>
                        ) : (
                            // Fallback to mock community activities for other tabs
                            communityActivities.slice(0, pageSize).map((activity) => (
                                <div
                                    key={activity.id}
                                    className="group relative bg-card/30 backdrop-blur-sm border border-white/5 rounded-xl p-3 flex items-center gap-4 transition-all hover:bg-card/50 hover:border-white/10"
                                >
                                    <div className="size-16 rounded-lg bg-white/5 overflow-hidden flex-shrink-0 border border-white/5">
                                        <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center">
                                            <Activity className="size-6 text-white/20" />
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex flex-wrap items-baseline gap-x-1.5">
                                                <span className="font-bold text-foreground text-sm truncate max-w-[120px]">
                                                    {activity.user}
                                                </span>
                                                {'subtitle' in activity && (
                                                    <span className="text-[10px] text-muted-foreground font-medium">
                                                        {activity.subtitle}
                                                    </span>
                                                )}
                                                <span className="text-muted-foreground text-xs whitespace-nowrap">
                                                    {activity.action}
                                                </span>
                                                <span className="font-semibold text-foreground text-xs truncate max-w-[150px]">
                                                    {activity.target}
                                                </span>
                                                <span className="font-mono text-green-400 text-xs font-bold pl-1">
                                                    {activity.value}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                                                {activity.time}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Your Activity Section */}
                <div className="space-y-6">
                    <div className="flex items-center gap-2">
                        <UserIcon className="size-5 text-foreground" />
                        <h2 className="text-xl font-semibold">Your Activity</h2>
                    </div>

                    <div className="space-y-4">
                        {yourActivities.map((activity) => (
                            <div
                                key={activity.id}
                                className="bg-gradient-to-br from-card/40 to-card/20 backdrop-blur-sm border border-white/5 rounded-2xl p-5 space-y-4 transition-all hover:border-white/10"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("p-2 rounded-xl", activity.iconColor)}>
                                            <activity.icon className="size-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-foreground">
                                                {activity.title}
                                            </h3>
                                            <p className="text-xs text-muted-foreground font-medium">
                                                {activity.target}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-medium text-muted-foreground">
                                        {activity.time}
                                    </span>
                                </div>

                                {activity.type === 'pb' && (
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-bold font-mono tracking-tight">
                                            {activity.value}
                                        </span>
                                        <span className="text-xs font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">
                                            {activity.diff}
                                        </span>
                                    </div>
                                )}

                                {activity.type === 'rating' && (
                                    <div className="flex gap-1">
                                        {[...Array(5)].map((_, i) => (
                                            <Star
                                                key={i}
                                                className={cn(
                                                    "size-4 fill-current",
                                                    i < (activity.rating || 0) ? "text-orange-500" : "text-neutral-800"
                                                )}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
