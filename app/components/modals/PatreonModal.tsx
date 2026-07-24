import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import { PatreonBadge, PATREON_EVENT } from '@/app/components/shared/PatreonBadge'
import { openExternal } from '@/app/platform'

const PATREON_URL = 'https://patreon.com/utbt'

const TIERS = [
    { tier: 1 as const, label: 'Tier 1', blurb: 'A heart by your name as a thank you for chipping in.' },
    { tier: 2 as const, label: 'Tier 2', blurb: 'A glowing heart that stands out.' },
    { tier: 3 as const, label: 'Tier 3', blurb: 'A golden, sparkling heart for our top supporters.' },
]

const STEPS = [
    'Become a patron at patreon.com/utbt and pick a tier.',
    'Link your Discord account to Patreon so we can match it to your UTBT profile.',
    'Your heart appears next to your name on our website, launcher and servers as a thank you for your support.',
]

export function PatreonModal() {
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        const open = () => setIsOpen(true)
        window.addEventListener(PATREON_EVENT, open)
        return () => window.removeEventListener(PATREON_EVENT, open)
    }, [])

    const close = () => setIsOpen(false)
    const openPatreon = () => openExternal(PATREON_URL)

    return (
        <Modal
            isOpen={isOpen}
            onClose={close}
            title="Support UTBT"
            maxWidth="40rem"
            offsetSidebar
            footer={
                <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2 shrink-0">
                    <Button variant="secondary" onClick={close}>
                        Maybe later
                    </Button>
                    <Button onClick={openPatreon} className="bg-rose-500 text-white hover:bg-rose-500/90">
                        <Heart className="size-4 fill-current" />
                        Become a Supporter
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">
                <p className="text-sm text-foreground/85 leading-relaxed">
                    UTBT is free and community run. Supporting us through Patreon helps keep our servers online. As a thank you, supporters get a Discord role, and a heart displayed next to their name on our website, launcher and servers.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {TIERS.map(({ tier, label, blurb }) => (
                        <div
                            key={tier}
                            className="flex flex-col items-center text-center gap-2 px-3 py-4 rounded-lg bg-hairline/[0.02] border border-hairline/5"
                        >
                            <PatreonBadge tier={tier} size="lg" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                {label}
                            </span>
                            <p className="text-xs text-foreground/70 leading-relaxed">{blurb}</p>
                        </div>
                    ))}
                </div>

                <div className="space-y-3">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-rose-300">
                        How to support us
                    </div>
                    <ol className="space-y-2.5">
                        {STEPS.map((step, i) => (
                            <li key={i} className="flex items-start gap-3 text-sm text-foreground/85 leading-relaxed">
                                <span className="flex items-center justify-center size-5 shrink-0 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[11px] font-bold">
                                    {i + 1}
                                </span>
                                <span>{step}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </Modal>
    )
}
