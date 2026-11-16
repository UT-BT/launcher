import { Fragment, useMemo, useRef, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Medal, Trophy, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { useModalBehaviour } from '@/app/components/ui/useModalBehaviour'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { NavLink } from '@/app/components/navigation/NavLink'
import { toActiveTitle, type Celebration, type CelebrationMember, type CelebrationPlace } from '@/app/utils/api'
import { getReadableTitleColor } from '@/app/utils/titleStyles'
import { useTheme } from '@/app/theme/ThemeProvider'
import { isLightTheme } from '@/app/theme/themes'
import './championsCelebration.css'

const MEDAL_RGB = {
    1: [255, 215, 0],
    2: [192, 192, 192],
    3: [206, 137, 70],
} as const

const PLACE_LABELS = { 2: 'Runner-up', 3: 'Third place' } as const

const CONFETTI_COLORS = ['#facc15', '#fde68a', '#f59e0b', '#ffffff', '#fb7185', '#38bdf8', '#a3e635']
const CONFETTI_PIECES = 42

interface ChampionsCelebrationProps {
    celebration: Celebration
    onClose: () => void
    onOpenStats: () => void
}

function medalColour(place: 1 | 2 | 3, light: boolean): string {
    const [r, g, b] = MEDAL_RGB[place]
    return getReadableTitleColor(r, g, b, light)
}

function confettiPieces(): CSSProperties[] {
    return Array.from({ length: CONFETTI_PIECES }, (_, index) => {
        const spread = ((index * 137.508) % 360) * (Math.PI / 180)
        const reach = 160 + ((index * 53) % 220)
        const dx = Math.cos(spread) * reach
        const rise = -Math.abs(Math.sin(spread)) * reach * 0.9 - 40
        return {
            '--dx': `${Math.round(dx)}px`,
            '--rise': `${Math.round(rise)}px`,
            '--fall': `${Math.round(rise + 260 + ((index * 31) % 180))}px`,
            '--spin': `${((index * 97) % 720) - 360}deg`,
            '--delay': `${(index % 6) * 45}ms`,
            '--c': CONFETTI_COLORS[index % CONFETTI_COLORS.length],
            width: index % 3 === 0 ? 6 : 9,
            height: index % 3 === 0 ? 6 : 4,
            borderRadius: index % 3 === 0 ? 9999 : 1,
        } as CSSProperties
    })
}

function Players({ members, size, onPick }: { members: CelebrationMember[]; size: 'xl' | 'sm'; onPick: () => void }) {
    return (
        <div
            onClickCapture={event => {
                if ((event.target as HTMLElement).closest('a, button, [role="button"]')) onPick()
            }}
            className={cn(
                'flex items-start justify-center',
                size === 'xl' ? 'gap-3 sm:gap-6' : 'flex-col items-center gap-1.5',
            )}
        >
            {members.map((member, index) => (
                <Fragment key={member.user}>
                    {size === 'xl' && index > 0 && (
                        <span aria-hidden className="mt-6 text-2xl font-light text-muted-foreground">&amp;</span>
                    )}
                    <PlayerInfo
                        userId={member.user}
                        alias={member.alias}
                        title={toActiveTitle(member.title)}
                        size={size}
                        layout={size === 'xl' ? 'vertical' : 'horizontal'}
                        className={size === 'xl' ? 'champions-player' : 'max-w-full'}
                    />
                </Fragment>
            ))}
        </div>
    )
}

function PodiumCard({ place, light, wide, onPick }: { place: CelebrationPlace; light: boolean; wide: boolean; onPick: () => void }) {
    const rank = place.place === 2 ? 2 : 3
    const colour = medalColour(rank, light)
    return (
        <div
            className={cn(
                'champions-rise flex min-w-0 flex-col items-center gap-2 rounded-xl border border-hairline/10 bg-card/60 px-3 py-4 text-center',
                wide && 'col-span-2',
            )}
            style={{ '--delay': rank === 2 ? '450ms' : '550ms', borderColor: `color-mix(in srgb, ${colour} 35%, transparent)` } as CSSProperties}
        >
            <div className="champions-label flex items-center gap-1.5" style={{ color: colour }}>
                <Medal className="size-4" aria-hidden />
                {PLACE_LABELS[rank]}
            </div>
            <p className="w-full truncate text-base font-bold text-foreground">{place.team.name}</p>
            <Players members={place.team.members} size="sm" onPick={onPick} />
        </div>
    )
}

export function ChampionsCelebration({ celebration, onClose, onOpenStats }: ChampionsCelebrationProps) {
    const panelRef = useRef<HTMLDivElement>(null)
    useModalBehaviour(panelRef, true, onClose)
    const { themeId } = useTheme()
    const light = isLightTheme(themeId)
    const pieces = useMemo(confettiPieces, [])

    const champion = celebration.podium.find(place => place.place === 1)
    const runnerUp = celebration.podium.find(place => place.place === 2)
    const others = celebration.podium.filter(place => place.place !== 1)
    if (!champion) return null

    const gold = medalColour(1, light)
    const { winner, loser } = celebration.final_score

    const openStats = () => {
        onClose()
        onOpenStats()
    }

    return createPortal(
        <div
            data-modal-backdrop
            onClick={event => { if (event.target === event.currentTarget) onClose() }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm touch:backdrop-filter-none p-4 animate-in fade-in duration-300"
        >
            <div aria-hidden className="champions-confetti pointer-events-none">
                {pieces.map((style, index) => <span key={index} style={style} />)}
            </div>
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="champions-title"
                className="champions-panel relative w-full max-w-lg max-h-full overflow-y-auto overscroll-contain rounded-2xl border bg-card shadow-2xl animate-in zoom-in-95 duration-300"
                style={{ borderColor: `color-mix(in srgb, ${gold} 35%, transparent)` }}
            >
                <div aria-hidden className="champions-glow pointer-events-none" />
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-hairline/10 hover:text-foreground"
                >
                    <X className="size-4" />
                </button>

                <div className="champions-hero relative flex flex-col items-center px-5 pb-6 text-center sm:px-8">
                    <div className="champions-trophy-slot relative">
                        <div aria-hidden className="champions-rays" />
                        <div className="champions-trophy champions-pop">
                            <Trophy strokeWidth={2.2} aria-hidden />
                        </div>
                    </div>

                    <p className="champions-eyebrow champions-rise" style={{ color: gold, '--delay': '120ms' } as CSSProperties}>
                        {celebration.name}
                    </p>
                    <h2 id="champions-title" className="champions-rise mt-2 text-sm font-medium text-muted-foreground sm:text-base" style={{ '--delay': '180ms' } as CSSProperties}>
                        Congratulations to the champions
                    </h2>
                    <p className={cn('champions-name mt-1 max-w-full break-words font-black tracking-tight', light && 'champions-name-light')} style={{ '--delay': '240ms' } as CSSProperties}>
                        {champion.team.name}
                    </p>

                    <div className="champions-rise mt-5 max-w-full" style={{ '--delay': '320ms' } as CSSProperties}>
                        <Players members={champion.team.members} size="xl" onPick={onClose} />
                    </div>

                    {runnerUp && (
                        <p
                            className="champions-rise mt-5 inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
                            style={{ color: gold, borderColor: `color-mix(in srgb, ${gold} 30%, transparent)`, background: `color-mix(in srgb, ${gold} 8%, transparent)`, '--delay': '380ms' } as CSSProperties}
                        >
                            <span className="truncate">Grand Final · {winner}–{loser} vs {runnerUp.team.name}</span>
                        </p>
                    )}
                </div>

                {others.length > 0 && (
                    <div className="relative grid grid-cols-2 gap-3 px-5 pb-6 sm:px-8">
                        {others.map((place, index) => (
                            <PodiumCard
                                key={place.team.id}
                                place={place}
                                light={light}
                                wide={others.length === 3 && index === 0}
                                onPick={onClose}
                            />
                        ))}
                    </div>
                )}

                <div className="relative flex flex-col-reverse gap-2 border-t border-hairline/10 px-5 py-4 sm:flex-row sm:justify-end sm:px-8">
                    <Button variant="ghost" onClick={onClose}>Close</Button>
                    <NavLink
                        view="event-detail"
                        params={{ eventSlug: celebration.slug, eventTab: 'teams' }}
                        onActivate={openStats}
                        className="champions-cta inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold"
                    >
                        See the cup stats
                        <ArrowRight className="size-4" aria-hidden />
                    </NavLink>
                </div>
            </div>
        </div>,
        document.body,
    )
}
