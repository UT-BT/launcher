import { useState } from 'react'
import { Check, ChevronLeft, ListVideo, Share2 } from 'lucide-react'
import { NavLink } from '@/app/components/navigation/NavLink'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { useCopyFeedback } from '@/app/hooks/useCopyFeedback'
import { displayMapName } from '@/app/utils/format'
import { stateOf, type CompareModel } from './model/compareModel'
import { formatRaceTime } from './model/raceModel'
import type { PlaybackController } from './playback/playbackController'
import { compareShareLink } from './url/shareLink'

export const COMPARE_RUNS = 'Compare Runs'

export function compareSubtitle(model: Pick<CompareModel, 'runs' | 'teams'>): string {
    const { rows } = model.teams
    if (rows.length > 0) {
        const size = rows[0].team.members.length
        return `${size}-player · ${rows.length} team ${rows.length === 1 ? 'run' : 'runs'}`
    }
    return `Solo · ${model.runs.length} ${model.runs.length === 1 ? 'run' : 'runs'}`
}

function ShareMenu({ model, controller }: { model: CompareModel; controller: PlaybackController | null }) {
    const [at, setAt] = useState<number | null>(null)
    const [withTime, setWithTime] = useState(true)
    const { copiedKey, copy } = useCopyFeedback(() => undefined)
    const seconds = at !== null && at > 0 && withTime ? at : null
    return (
        <DropdownMenu onOpenChange={open => { if (open) setAt(controller?.getState().t ?? null) }}>
            <DropdownMenuTrigger asChild>
                <button type="button" className="run-compare-header-button">
                    {copiedKey ? <Check className="size-4" /> : <Share2 className="size-4" />}
                    <span>{copiedKey ? 'Link Copied' : 'Share'}</span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="run-compare-menu">
                <DropdownMenuLabel>Share This Comparison</DropdownMenuLabel>
                {at !== null && at > 0 && (
                    <DropdownMenuCheckboxItem
                        checked={withTime}
                        onSelect={event => {
                            event.preventDefault()
                            setWithTime(!withTime)
                        }}
                    >
                        Start at {formatRaceTime(at)}
                    </DropdownMenuCheckboxItem>
                )}
                <DropdownMenuItem onSelect={() => void copy('link', compareShareLink(stateOf(model), seconds))}>
                    Copy Link
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

interface RunCompareHeaderProps {
    model: CompareModel
    controller: PlaybackController | null
    runsOpen: boolean
    onToggleRuns: () => void
}

function BackToStart() {
    const { navigate } = useNavigation()
    return (
        <nav aria-label="Breadcrumb" className="run-compare-crumbs">
            <NavLink view="run-compare" params={{}} onActivate={() => navigate('run-compare', {})} className="run-compare-crumb">
                <ChevronLeft aria-hidden className="size-3.5" />
                {COMPARE_RUNS}
            </NavLink>
        </nav>
    )
}

export function RunCompareHeader({ model, controller, runsOpen, onToggleRuns }: RunCompareHeaderProps) {
    const ready = !model.loading && model.runs.length > 0
    return (
        <header className="run-compare-header">
            <div className="run-compare-heading">
                {model.map && <BackToStart />}
                <h1 className="text-2xl font-bold text-foreground leading-tight">
                    {model.map ? (
                        <>
                            <span className="sr-only">{COMPARE_RUNS}: </span>
                            {displayMapName(model.map)}
                        </>
                    ) : COMPARE_RUNS}
                </h1>
                {ready && <p className="text-sm text-muted-foreground">{compareSubtitle(model)}</p>}
            </div>
            {ready && (
                <div className="run-compare-header-actions">
                    <ShareMenu model={model} controller={controller} />
                    <button
                        type="button"
                        aria-expanded={runsOpen}
                        aria-controls="run-compare-drawer"
                        className="run-compare-header-button is-accent"
                        onClick={onToggleRuns}
                    >
                        <ListVideo className="size-4" />
                        <span>Runs · {model.teams.rows.length > 0 ? model.teams.rows.length : model.runs.length}</span>
                    </button>
                </div>
            )}
        </header>
    )
}
