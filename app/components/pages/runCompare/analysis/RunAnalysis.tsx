import { useCallback } from 'react'
import { sectorLabel } from '@/app/components/pages/capDetail/runDelta/deltaCurve'
import type { AnalysisModel, MatrixRow } from '../model/analysisModel'
import { SIDE_TAGS } from '../model/laneModel'
import type { PlaybackController } from '../playback/playbackController'
import { SideTag } from '../stage/Tags'
import type { CueSync } from '../transport/useCueSync'
import { SectorTimes } from './SectorTimes'
import { SpeedView } from './SpeedView'
import './analysis.css'

interface RunAnalysisProps {
    analysis: AnalysisModel
    controller: PlaybackController | null
    cueSync: CueSync
    onSpeedRun: (capId: string) => void
}

interface AnalysisPanelsProps extends RunAnalysisProps {
    heading?: 'h2' | 'h3'
}

export function AnalysisPanels({ analysis, controller, cueSync, onSpeedRun, heading: Heading = 'h2' }: AnalysisPanelsProps) {
    const { runs, matrix, speed } = analysis
    const { cue } = cueSync
    const onRow = useCallback((row: MatrixRow) => {
        if (row.cue) cue(row.cue)
        else controller?.seek(row.atMs / 1000)
    }, [cue, controller])
    const onSector = useCallback((index: number) => {
        const row = matrix.find(candidate => candidate.kind === 'sector' && candidate.label === sectorLabel(index))
        if (row) onRow(row)
    }, [matrix, onRow])

    return (
        <>
            <SectorTimes runs={runs} rows={matrix} activeCue={cueSync.active} onRow={onRow} heading={Heading} />
            {speed.options.length > 0 && (
                <SpeedView speed={speed} controller={controller} onChoose={onSpeedRun} onSector={onSector} heading={Heading} />
            )}
        </>
    )
}

function SideNote({ side }: { side: number }) {
    const other = SIDE_TAGS[1 - side]
    return (
        <p className="run-compare-analysis-side">
            <SideTag side={side} label={SIDE_TAGS[side]} />
            <span>Only the {SIDE_TAGS[side].toLowerCase()} runs are analysed here. {other} runs take another route, so they compare by final time.</span>
        </p>
    )
}

export default function RunAnalysis({ side = null, ...props }: RunAnalysisProps & { side?: number | null }) {
    return (
        <section aria-label="Analysis" className="run-compare-analysis">
            {(side === 0 || side === 1) && <SideNote side={side} />}
            <AnalysisPanels {...props} />
        </section>
    )
}
