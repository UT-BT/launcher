import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import type { CasterName } from './casterView'

export function CasterPlate({ caster, zoom, className }: { caster: CasterName; zoom: number; className?: string }) {
    const style: CSSProperties = { zoom }
    return (
        <div data-caster className={cn('rounded-2xl bg-white/[0.06] shadow-[0_0_0_1px_rgba(255,255,255,0.1)]', className)}>
            <div style={style}>
                <PlayerInfo userId={caster.userId ?? undefined} alias={caster.name} size="md" interactive={false} />
            </div>
        </div>
    )
}
