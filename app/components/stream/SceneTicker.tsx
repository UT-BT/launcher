import { AnimatePresence, motion } from 'framer-motion'
import { EASE_OUT } from '@/app/components/broadcast/broadcastMotion'
import { PICK_BAN_TONES } from '@/app/components/broadcast/broadcastTone'
import { SceneLogo } from './frame/SceneBranding'
import { useSceneNow, useSceneRead, useStreamData } from './data/useStreamData'
import { streamFeedPath, type StreamFeed } from './ticker/streamFeed'
import { TickerItemView } from './ticker/TickerItems'
import { tickerRotation, tickerSets } from './ticker/tickerModel'

const SET_TRANSITION = { duration: 0.35, ease: EASE_OUT }

export function SceneTicker() {
    const { eventSlug, streamerId } = useStreamData()
    const { data } = useSceneRead<StreamFeed>(streamFeedPath(eventSlug, streamerId))
    const now = useSceneNow()
    const rotation = tickerRotation(tickerSets(data, now), now)
    if (!rotation) return null
    const { set } = rotation

    return (
        <div
            data-ticker-set={set.kind}
            className="relative flex h-full w-full items-center overflow-hidden border-t border-white/[0.12] bg-gradient-to-b from-[#05070c]/80 to-[#05070c]/95"
        >
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={set.kind}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0, transition: SET_TRANSITION }}
                    exit={{ opacity: 0, y: -14, transition: { duration: 0.2 } }}
                    className="flex h-full min-w-0 flex-1 items-center"
                >
                    <div
                        className={`flex h-full shrink-0 items-center whitespace-nowrap py-0 pl-16 pr-[52px] text-[26px] font-black italic uppercase tracking-[0.04em] ${PICK_BAN_TONES.gold.solid} ${PICK_BAN_TONES.gold.onSolid}`}
                        style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 28px) 100%, 0 100%)' }}
                    >
                        {set.tag}
                    </div>
                    <ul
                        className="mr-[250px] flex min-w-0 flex-1 items-center gap-[22px] overflow-hidden whitespace-nowrap pl-7 text-[26px] font-bold uppercase tracking-[0.06em]"
                        style={{ maskImage: 'linear-gradient(to right, black calc(100% - 48px), transparent)' }}
                    >
                        {set.items.map((item, index) => (
                            <li key={item.key} className="flex items-center gap-[22px]">
                                {index > 0 && <span aria-hidden className="size-2 shrink-0 rotate-45 bg-white/30" />}
                                <span className="flex items-center gap-3.5">
                                    <TickerItemView item={item} />
                                </span>
                            </li>
                        ))}
                    </ul>
                </motion.div>
            </AnimatePresence>
            <div
                className="absolute inset-y-0 right-0 flex items-center gap-3 pl-[90px] pr-10 text-xl font-bold uppercase tracking-[0.2em] text-white/60"
                style={{ background: 'linear-gradient(to right, transparent, rgb(5 7 12 / 0.95) 60px)' }}
            >
                <SceneLogo className="size-10" />
                utbt.net
            </div>
        </div>
    )
}
