import { motion } from 'framer-motion'
import { PICK_BAN_HUES, tint, type PickBanTone } from './broadcastTone'

export function BroadcastBackdrop({ left, right, lit = null }: { left: PickBanTone; right: PickBanTone; lit?: 'left' | 'right' | null }) {
    const leftHue = PICK_BAN_HUES[left]
    const rightHue = PICK_BAN_HUES[right]

    return (
        <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
                className="absolute inset-0"
                style={{
                    background: [
                        `radial-gradient(ellipse 55% 70% at 0% 0%, ${tint(leftHue, 20)}, transparent 70%)`,
                        `radial-gradient(ellipse 55% 70% at 100% 0%, ${tint(rightHue, 20)}, transparent 70%)`,
                        'radial-gradient(ellipse 80% 60% at 50% 110%, rgba(255,255,255,0.06), transparent 70%)',
                    ].join(', '),
                }}
            />
            <div
                className="absolute inset-0 opacity-60"
                style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
                    backgroundSize: '64px 64px',
                    maskImage: 'radial-gradient(ellipse 75% 70% at 50% 45%, black, transparent)',
                }}
            />
            <motion.div
                initial={false}
                animate={{ opacity: lit === 'left' ? 1 : 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-y-0 left-0 w-1/2"
                style={{ background: `radial-gradient(ellipse 70% 60% at 0% 55%, ${tint(leftHue, 22)}, transparent 70%)` }}
            />
            <motion.div
                initial={false}
                animate={{ opacity: lit === 'right' ? 1 : 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-y-0 right-0 w-1/2"
                style={{ background: `radial-gradient(ellipse 70% 60% at 100% 55%, ${tint(rightHue, 22)}, transparent 70%)` }}
            />
            <div className="absolute inset-0 shadow-[inset_0_0_220px_rgba(0,0,0,0.75)]" />
        </div>
    )
}
