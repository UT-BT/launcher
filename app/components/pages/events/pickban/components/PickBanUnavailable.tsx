import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ApiError } from '@/app/utils/api'

interface PickBanUnavailableProps {
    error: unknown
    icon?: LucideIcon
    className?: string
}

export function pickBanUnavailableIsHidden(error: unknown): boolean {
    return error instanceof ApiError && [401, 403, 404].includes(error.status)
}

export function PickBanUnavailable({ error, icon: Icon, className }: PickBanUnavailableProps) {
    const hidden = pickBanUnavailableIsHidden(error)
    return (
        <div className={cn('flex flex-col items-center justify-center gap-2 text-center', className)}>
            {Icon && <Icon className="size-8 text-muted-foreground" />}
            <h2 className="text-lg font-semibold text-foreground">
                {hidden ? 'Picks & Bans page not available' : 'Failed to load Picks & Bans'}
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
                {hidden
                    ? 'The match may not be published yet, or the link is wrong.'
                    : 'Trying again in the background.'}
            </p>
        </div>
    )
}
