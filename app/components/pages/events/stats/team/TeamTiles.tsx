import type { ReactNode } from 'react'
import type { TeamTilesView } from '@/app/components/pages/events/stats/statsView'
import { FormPips, SECTION_LABEL } from './teamShared'

function Tile({ label, value, children }: { label: string; value: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-hairline/10 bg-card/30 p-3">
            <span className={SECTION_LABEL}>{label}</span>
            <span className="text-3xl font-black leading-none tabular-nums text-foreground">{value}</span>
            {children}
        </div>
    )
}

function Note({ children }: { children: ReactNode }) {
    return <span className="text-xs text-muted-foreground">{children}</span>
}

export function TeamTiles({ tiles }: { tiles: TeamTilesView }) {
    return (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <Tile label="Matches" value={tiles.matches.value}>
                <FormPips pips={tiles.matches.form} summary={tiles.matches.summary} />
            </Tile>
            <Tile label="Maps" value={tiles.maps.value}>
                <Note>{tiles.maps.note}</Note>
            </Tile>
            <Tile label="Caps for / against" value={tiles.caps.value}>
                {tiles.caps.note && <Note>{tiles.caps.note}</Note>}
            </Tile>
            <Tile label="Pace" value={tiles.pace.value}>
                <Note>{tiles.pace.note}</Note>
            </Tile>
        </div>
    )
}
