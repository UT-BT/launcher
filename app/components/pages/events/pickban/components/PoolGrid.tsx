import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { displayMapName } from '@/app/utils/format'
import type { PickBanActor } from '@/app/utils/api'
import type { PickBanCardView } from '../pickBanView'
import { PICK_BAN_TONES, stepTone, teamTone } from './pickBanTone'
import { CHIP_MOTION, STAMP_MOTION } from './stageMotion'

const CORNER_CHIP = 'absolute right-1 top-1 rounded px-1.5 py-px text-[10px] font-bold uppercase'

interface PoolGridProps {
    cards: PickBanCardView[]
    previewActor: PickBanActor | null
    onSelect?: (map: string) => void
    className?: string
}

export function PoolGrid({ cards, previewActor, onSelect, className }: PoolGridProps) {
    return (
        <div className="@container/grid">
            <ul
                className={cn(
                    'grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-2',
                    '@3xl/grid:grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] @3xl/grid:gap-3',
                    '@7xl/grid:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]',
                    '@[140rem]/grid:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] @[140rem]/grid:gap-4',
                    className,
                )}
            >
                {cards.map(card => (
                    <li key={card.key}>
                        <PoolCard card={card} previewActor={previewActor} onSelect={onSelect} />
                    </li>
                ))}
            </ul>
        </div>
    )
}

function cardLabel(card: PickBanCardView, name: string): string {
    switch (card.state) {
        case 'banned':
            return `${name}, banned by team ${card.ab} at step ${card.stepNumber}`
        case 'picked':
            return `${name}, picked by team ${card.ab} as map ${card.mapNumber}`
        case 'decider':
            return `${name}, the decider, map ${card.mapNumber}`
        case 'excluded':
            return `${name}, excluded. ${card.exclusionReason ?? ''}`.trim()
        default:
            return card.previewed ? `${name}, being considered` : name
    }
}

export function PoolCard({ card, previewActor, onSelect }: {
    card: PickBanCardView
    previewActor: PickBanActor | null
    onSelect?: (map: string) => void
}) {
    const name = displayMapName(card.map)
    const tone = PICK_BAN_TONES[stepTone(card.state === 'decider' ? null : card.ab)]
    const previewTone = PICK_BAN_TONES[teamTone(previewActor)]
    const acted = card.state === 'banned' || card.state === 'picked' || card.state === 'decider'
    const choosable = onSelect !== undefined && card.selectable

    return (
        <div
            title={card.state === 'excluded' ? card.exclusionReason ?? undefined : card.map}
            className={cn(
                'relative aspect-square overflow-hidden rounded-lg border-2 bg-card/30 transition-[border-color,box-shadow] duration-300',
                card.state === 'available' && !card.previewed && 'border-hairline/10',
                card.state === 'excluded' && 'border-hairline/5',
                acted && tone.border,
                card.previewed && cn('ring-2', previewTone.border, previewTone.ring),
                card.selected && cn('ring-4', previewTone.border, previewTone.ring),
            )}
        >
            <span className="sr-only">{cardLabel(card, name)}</span>
            <MapThumbnail
                mapName={card.map}
                version={card.screenshotVersion}
                size="card"
                alt=""
                className={cn(
                    'absolute inset-0 h-full w-full rounded-none border-0 transition-[filter,opacity] duration-500',
                    card.state === 'banned' && 'grayscale brightness-50',
                    card.state === 'excluded' && 'grayscale opacity-30',
                )}
            />
            <AnimatePresence initial={false}>
                {card.stepNumber !== null && (
                    <motion.span key="step" aria-hidden {...CHIP_MOTION} className="absolute left-1 top-1 rounded bg-black/60 px-1 py-px font-mono text-[10px] font-bold text-white">
                        #{card.stepNumber}
                    </motion.span>
                )}
                {card.state === 'picked' && (
                    <motion.span key="picked" aria-hidden {...CHIP_MOTION} className={cn(CORNER_CHIP, tone.solid, tone.onSolid)}>
                        Map {card.mapNumber}
                    </motion.span>
                )}
                {card.state === 'decider' && (
                    <motion.span key="decider" aria-hidden {...CHIP_MOTION} className={cn(CORNER_CHIP, tone.solid, tone.onSolid)}>
                        Decider
                    </motion.span>
                )}
                {card.state === 'banned' && (
                    <motion.span key="banned" aria-hidden {...STAMP_MOTION} className="absolute inset-0 flex items-center justify-center">
                        <span className={cn('-rotate-12 rounded border-2 bg-black/40 px-1.5 py-0.5 text-[11px] font-black tracking-widest', tone.text, tone.border)}>
                            BANNED
                        </span>
                    </motion.span>
                )}
                {card.previewed && !card.selected && (
                    <motion.span key="previewed" aria-hidden {...CHIP_MOTION} className={cn(CORNER_CHIP, previewTone.solid, previewTone.onSolid)}>
                        Considering
                    </motion.span>
                )}
                {card.selected && (
                    <motion.span key="selected" aria-hidden {...CHIP_MOTION} className={cn(CORNER_CHIP, previewTone.solid, previewTone.onSolid)}>
                        Selected
                    </motion.span>
                )}
                {card.lockedIn && (
                    <motion.span key="locked-in" aria-hidden {...CHIP_MOTION} className={cn(CORNER_CHIP, 'bg-emerald-500 text-white')}>
                        Locked in
                    </motion.span>
                )}
            </AnimatePresence>
            {card.state === 'excluded' && (
                <span aria-hidden className="absolute inset-x-1 top-1/2 -translate-y-1/2 text-center text-[10px] font-bold uppercase tracking-wider text-foreground/80">
                    Excluded
                    {card.exclusion && <span className="block normal-case tracking-normal font-medium">{card.exclusion.tag} maps</span>}
                </span>
            )}
            <span
                aria-hidden
                className={cn(
                    'absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1 pt-4 text-[11px] font-semibold text-white',
                    card.state === 'excluded' && 'text-white/60',
                )}
            >
                {name}
            </span>
            {choosable && (
                <button
                    type="button"
                    aria-pressed={card.selected}
                    aria-label={`Select ${name}`}
                    onClick={() => onSelect(card.map)}
                    className="absolute inset-0 cursor-pointer rounded-md transition-colors hover:bg-hairline/10 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent-500"
                />
            )}
        </div>
    )
}
