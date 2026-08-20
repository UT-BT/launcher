import { useRef } from 'react'
import { Flag, Map as MapIcon, Server, Trophy } from 'lucide-react'
import { NavLink } from '@/app/components/navigation/NavLink'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { useNavScrollRestore } from '@/app/components/navigation/useNavScrollRestore'

const CTA_CLASS =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent-500/15 border border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:text-foreground hover:border-accent-500/60 transition-colors text-sm font-semibold'

export function BunnyTrackPage() {
    const { navigate } = useNavigation()
    const scrollRef = useRef<HTMLDivElement>(null)
    const onScroll = useNavScrollRestore(scrollRef, true)

    return (
        <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto custom-scrollbar">
            <div className="p-6">
                <article className="mx-auto max-w-3xl space-y-8">
                    <header className="space-y-3">
                        <h1 className="text-3xl font-black text-foreground leading-tight">What is BunnyTrack?</h1>
                        <p className="text-base text-muted-foreground leading-relaxed">
                            BunnyTrack (BT) is a team obstacle-course game mode for Unreal Tournament 1999. Instead of
                            fighting, two teams race through a course of jumps, dodges, traps and timing puzzles and
                            score by capturing the flag at the end. UTBT is the community that keeps it running: public
                            servers, verified records, and this site tracking all of it live.
                        </p>
                    </header>

                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-foreground">How the mode works</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            BunnyTrack grew out of Capture the Flag with combat removed. In the classic layout the red
                            and blue teams run mirrored courses separated by glass, so you can see the other team but
                            never touch them. The course itself is the opponent: moving platforms, crushers, disappearing
                            floors, precise jumps and timing sections stand between spawn and the enemy flag. Touch the
                            flag at the end and your team scores a point.
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Winning runs come down to mastering Unreal Tournament 1999 movement — strafe jumps, dodge
                            chains, lift jumps and clean lines — plus learning each map's traps and shortcuts.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-foreground">Records, medals and rankings</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Every finish (a cap) on a UTBT server is timed to the millisecond. The fastest verified cap
                            on a map is its world record, and each map awards champion, gold, silver and bronze medals
                            for beating its time thresholds. Caps feed the player leaderboard, team records, and Cap It
                            All — the race to cap every map at least once.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <NavLink view="world-records" onActivate={() => navigate('world-records')} className={CTA_CLASS}>
                                <Trophy className="size-3.5" />
                                World Records
                            </NavLink>
                            <NavLink view="cap-it-all" onActivate={() => navigate('cap-it-all')} className={CTA_CLASS}>
                                <Flag className="size-3.5" />
                                Cap It All
                            </NavLink>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-foreground">The maps</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            More than 3,000 BunnyTrack maps are active on UTBT servers, from beginner-friendly courses to
                            precision gauntlets that take weeks to master. Every map page shows its difficulty, author,
                            medal thresholds and full record history.
                        </p>
                        <NavLink view="maps" onActivate={() => navigate('maps')} className={CTA_CLASS}>
                            <MapIcon className="size-3.5" />
                            Browse Maps
                        </NavLink>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-foreground">How to start playing</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            All you need is Unreal Tournament 1999. Pick a server in the server browser, join, and the
                            map downloads automatically. New runners are welcome on every server — spectate a few runs,
                            follow the players who know the route, and start capping. Your times, medals and rank build
                            from your very first cap.
                        </p>
                        <NavLink view="servers" onActivate={() => navigate('servers')} className={CTA_CLASS}>
                            <Server className="size-3.5" />
                            Find a Server
                        </NavLink>
                    </section>
                </article>
            </div>
        </div>
    )
}
