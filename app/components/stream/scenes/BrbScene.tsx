import { useSceneMatch } from '../data/useStreamData'
import { BlankFrame, IdleFrame } from '../frame/IdleFrame'
import { SceneFrame } from '../frame/SceneFrame'
import { brbView } from './brb/brbView'
import { SeriesScoreCard } from './brb/SeriesScoreCard'

export default function BrbScene() {
    const { phase, state } = useSceneMatch()

    if (phase === 'loading') return <BlankFrame scene="brb" />
    if (state === null) return <IdleFrame scene="brb" />
    const view = brbView(state)

    return (
        <SceneFrame scene="brb" title="Be right back" kicker="Short break">
            <div className="flex h-full flex-col items-center justify-center gap-[34px]">
                <div className="flex items-center gap-[30px]">
                    <span className="flex size-[120px] items-center justify-center rounded-full bg-white/[0.08] shadow-[0_0_0_2px_rgba(255,255,255,0.12)]">
                        <svg width="54" height="54" viewBox="0 0 24 24" fill="#fff" aria-hidden>
                            <rect x="5" y="4" width="5" height="16" rx="1.5" />
                            <rect x="14" y="4" width="5" height="16" rx="1.5" />
                        </svg>
                    </span>
                    <p className="text-[150px] font-black italic uppercase leading-[0.9] [text-shadow:0_6px_30px_rgba(0,0,0,0.6)]">Be right back</p>
                </div>
                <div className="max-w-[1400px] rounded-2xl bg-white/[0.06] px-10 py-[26px] shadow-[0_0_0_1px_rgba(255,255,255,0.1)]">
                    <p data-brb-message className="text-center font-sans text-[40px] leading-[1.35] text-white/90">
                        {view.message}
                    </p>
                </div>
                {view.score && <SeriesScoreCard score={view.score} large className="w-[900px]" />}
            </div>
        </SceneFrame>
    )
}
