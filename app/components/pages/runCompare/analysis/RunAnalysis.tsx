import { useCallback } from 'react'
import { sectorLabel } from '@/app/components/pages/capDetail/runDelta/deltaCurve'
import type { AnalysisModel, AnalysisRun, MatrixRow } from '../model/analysisModel'
import { TIME_ONLY } from '../model/laneModel'
import type { PlaybackController } from '../playback/playbackController'
import type { CueSync } from '../transport/useCueSync'
import { CumulativeChart } from './CumulativeChart'
import { RunIdentity } from './RunIdentity'
import { SectorMatrix } from './SectorMatrix'
import { SpeedView } from './SpeedView'
import './analysis.css'

interface RunAnalysisProps {
    analysis: AnalysisModel
    controller: PlaybackController | null
    cueSync: CueSync
    onSpeedRun: (capId: string) => void
}

function legendNote(run: AnalysisRun, timeOnly: readonly string[]): string | null {
    if (run.reference) return 'REF'
    if (timeOnly.includes(run.capId)) return TIME_ONLY
    return null
}

export default function RunAnalysis({ analysis, controller, cueSync, onSpeedRun }: RunAnalysisProps) {
    const { runs, cumulative, matrix, speed } = analysis
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
        <section aria-label="Analysis" className="run-compare-analysis">
            <div className="run-compare-panel">
                <h2>Cumulative Δ</h2>
                <CumulativeChart cumulative={cumulative} controller={controller} />
                <ul aria-label="Legend" className="run-compare-legend">
                    {runs.map(run => {
                        const note = legendNote(run, cumulative.timeOnly)
                        return (
                            <li key={run.capId}>
                                <span className="run-compare-legend-line" style={{ background: run.colour }} />
                                <RunIdentity run={run.run} />
                                {note && <span className="run-compare-badge">{note}</span>}
                            </li>
                        )
                    })}
                    <li><span className="run-compare-legend-band" />Different line</li>
                    <li>Above the dashed line is behind the reference, below is ahead</li>
                </ul>
            </div>
            <div className="run-compare-panel">
                <h2>Sector Matrix</h2>
                <SectorMatrix runs={runs} rows={matrix} activeCue={cueSync.active} onRow={onRow} />
                <p className="run-compare-legend"><span className="run-compare-legend-best" />Best split in the sector on its side</p>
            </div>
            {speed.options.length > 0 && (
                <div className="run-compare-panel">
                    <h2>Speed and Zoom</h2>
                    <SpeedView speed={speed} controller={controller} onChoose={onSpeedRun} onSector={onSector} />
                </div>
            )}
        </section>
    )
}
