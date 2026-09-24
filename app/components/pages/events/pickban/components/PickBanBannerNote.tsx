import { Ban, CircleSlash, Info, Pause, TriangleAlert, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PickBanBanner } from '../pickBanView'

interface BannerCopy {
    icon: LucideIcon
    title: string
    detail: string | null
    className: string
}

function bannerCopy(banner: PickBanBanner): BannerCopy {
    switch (banner.kind) {
        case 'voided':
            return {
                icon: CircleSlash,
                title: 'This pick/ban was voided',
                detail: banner.reason,
                className: 'bg-red-500/10 border-red-500/30 text-red-300',
            }
        case 'cancelled':
            return {
                icon: Ban,
                title: 'This pick/ban was cancelled',
                detail: banner.reason,
                className: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
            }
        case 'paused':
            return {
                icon: Pause,
                title: 'Paused',
                detail: 'Waiting for an admin to resume.',
                className: 'bg-accent-500/10 border-accent-500/30 text-accent-200',
            }
        case 'skipped_bans':
            return {
                icon: Info,
                title: `${banner.count} ${banner.count === 1 ? 'ban' : 'bans'} skipped`,
                detail: 'The eligible pool is too small for the full sequence, so bans are dropped from the end. Picks are never dropped.',
                className: 'bg-card/30 border-hairline/10 text-muted-foreground',
            }
        case 'warning':
            return {
                icon: TriangleAlert,
                title: banner.message,
                detail: null,
                className: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
            }
    }
}

export function PickBanBannerNote({ banner, className }: { banner: PickBanBanner; className?: string }) {
    const { icon: Icon, title, detail, className: tint } = bannerCopy(banner)

    return (
        <div role="status" className={cn('flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm', tint, className)}>
            <Icon className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 space-y-0.5">
                <p className="font-semibold">{title}</p>
                {detail && <p className="text-xs opacity-90">{detail}</p>}
            </div>
        </div>
    )
}
