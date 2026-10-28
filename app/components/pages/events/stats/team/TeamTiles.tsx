import type { ReactNode } from 'react'
import type { TeamTilesView } from '@/app/components/pages/events/stats/statsView'
import { FormPips, SECTION_LABEL } from './teamShared'

function Tile({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-hairline/10 bg-card/30 p-3">
            <span className={SECTION_LABEL}>{label}</span>
            <span className="text-2xl font-black leading-none tabular-nums text-foreground sm:text-3xl">{value}</span>
            {children}
        </div>
    )
}

export function TeamTiles({ tiles }: { tiles: TeamTilesView }) {
    return (
        <div className="grid grid-cols-3 gap-2.5">
            <Tile label="Matches" value={tiles.matches.value}>
                <FormPips pips={tiles.matches.form} summary={tiles.matches.summary} />
            </Tile>
            <Tile label="Maps" value={tiles.maps} />
            <Tile label="Caps" value={tiles.caps} />
        </div>
    )
}
