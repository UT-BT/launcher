import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import type { SoloRun } from '../loading/soloRuns'

type Identity = Pick<SoloRun, 'user' | 'alias' | 'title'>

export function runName(run: Pick<SoloRun, 'alias' | 'user'>): string {
    return run.alias?.trim() || run.user
}

interface RunIdentityProps {
    run: Identity
    presentation?: 'full' | 'name'
    withTitle?: boolean
    className?: string
}

export function RunIdentity({ run, presentation = 'name', withTitle = true, className }: RunIdentityProps) {
    return (
        <span inert className={cn('flex min-w-0', className)}>
            <PlayerInfo userId={run.user} alias={run.alias} title={withTitle ? run.title : null} size="sm" presentation={presentation} interactive={false} className="min-w-0" />
        </span>
    )
}
