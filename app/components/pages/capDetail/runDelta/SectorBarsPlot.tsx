import { Split } from 'lucide-react'
import { DeltaAxisMarks, DeltaGrid, deltaScale, type PlotBox } from './chartFrame'
import { HAIRLINE, TONE_STROKE } from './deltaStyles'
import type { SectorBars } from './runDeltaCard'

const MARGIN = { left: 52, right: 16, top: 10, bottom: 22 }
const FORK_ROW_PX = 14
const FORK_ICON_PX = 10
const BAR_SHARE = 0.56
const MAX_BAR_PX = 28

interface SectorBarsPlotProps {
    bars: SectorBars
    width: number
    height: number
    description: string
}

export function SectorBarsPlot({ bars, width, height, description }: SectorBarsPlotProps) {
    const flagged = bars.bars.some(bar => bar.flagged)
    const box: PlotBox = {
        left: MARGIN.left,
        right: Math.max(MARGIN.left + 1, width - MARGIN.right),
        top: MARGIN.top,
        bottom: Math.max(MARGIN.top + 1, height - MARGIN.bottom - (flagged ? FORK_ROW_PX : 0)),
    }
    const y = deltaScale(bars.y, box)
    const slot = (box.right - box.left) / Math.max(1, bars.bars.length)
    const barWidth = Math.min(MAX_BAR_PX, slot * BAR_SHARE)
    const zeroY = y(bars.zeroLineMs)

    return (
        <svg width={width} height={height} role="img" aria-label={description} className="absolute inset-0 block font-mono">
            <DeltaGrid ticks={bars.y.ticks} box={box} y={y} />
            {bars.bars.map((bar, i) => {
                const center = box.left + slot * (i + 0.5)
                const valueY = y(bar.deltaMs)
                return (
                    <rect
                        key={`bar${bar.index}`}
                        x={center - barWidth / 2}
                        y={Math.min(zeroY, valueY)}
                        width={barWidth}
                        height={Math.max(1, Math.abs(valueY - zeroY))}
                        rx={1.5}
                        fill={TONE_STROKE[bar.tone]}
                    />
                )
            })}
            <line x1={box.left} x2={box.right} y1={zeroY} y2={zeroY} stroke={HAIRLINE(0.3)} />
            <DeltaAxisMarks ticks={bars.y.ticks} box={box} y={y} />
            <g fontSize={9} fill={HAIRLINE(0.5)}>
                {bars.bars.map((bar, i) => (
                    <text key={`l${bar.index}`} x={box.left + slot * (i + 0.5)} y={box.bottom + 14} textAnchor="middle">
                        {bar.label}
                    </text>
                ))}
            </g>
            {bars.bars.map((bar, i) => bar.flagged && (
                <Split
                    key={`f${bar.index}`}
                    x={box.left + slot * (i + 0.5) - FORK_ICON_PX / 2}
                    y={box.bottom + 18}
                    width={FORK_ICON_PX}
                    height={FORK_ICON_PX}
                    color={HAIRLINE(0.6)}
                    strokeWidth={2}
                    aria-hidden="true"
                />
            ))}
        </svg>
    )
}
