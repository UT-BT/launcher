import { BroadcastBackdrop } from '@/app/components/broadcast/BroadcastBackdrop'
import { PICK_BAN_HUES } from '@/app/components/broadcast/broadcastTone'
import { useSceneMatch } from '../data/useStreamData'
import { BlankFrame, IdleFrame } from '../frame/IdleFrame'
import { SceneFrame } from '../frame/SceneFrame'
import { SeriesScoreCard } from './brb/SeriesScoreCard'
import { CasterPlate } from './caster/CasterPanels'
import { CASTER_CUTOUT, casterView, type CasterView } from './caster/casterView'

const CANVAS = { width: 1920, height: 1080 }
const BODY_ORIGIN = { x: 64, y: 168 }
const BEZEL = 14
const { x, y, width, height } = CASTER_CUTOUT

const CUTOUT_HOLE = `polygon(evenodd, 0 0, ${CANVAS.width}px 0, ${CANVAS.width}px ${CANVAS.height}px, 0 ${CANVAS.height}px, 0 0, ${x}px ${y}px, ${x}px ${y + height}px, ${x + width}px ${y + height}px, ${x + width}px ${y}px, ${x}px ${y}px)`

function Corner({ left, top, rotate, hue }: { left: number; top: number; rotate: number; hue: string }) {
    return (
        <span
            className="absolute size-[84px] border-l-8 border-t-8"
            style={{ left, top, borderColor: hue, transform: `rotate(${rotate}deg)` }}
        />
    )
}

function WebcamLayer({ view }: { view: CasterView }) {
    return (
        <div
            data-caster-frame
            className="absolute overflow-hidden bg-[#05070c]"
            style={{ left: -BODY_ORIGIN.x, top: -BODY_ORIGIN.y, width: CANVAS.width, height: CANVAS.height, clipPath: CUTOUT_HOLE }}
        >
            <BroadcastBackdrop left="a" right="b" />
            <div
                className="absolute rounded-[18px] shadow-[0_0_0_4px_rgba(255,255,255,0.14),0_24px_60px_rgba(0,0,0,0.6)]"
                style={{ left: x - BEZEL, top: y - BEZEL, width: width + BEZEL * 2, height: height + BEZEL * 2 }}
            />
            <Corner left={x - 22} top={y - 22} rotate={0} hue={PICK_BAN_HUES.a} />
            <Corner left={x + width - 62} top={y + height - 62} rotate={180} hue={PICK_BAN_HUES.b} />
            <div className="absolute flex items-center gap-3.5" style={{ left: x, top: y + height + 30 }}>
                <span className="rounded-md bg-pickban-a px-3 py-1 text-base font-black uppercase tracking-[0.2em] text-white">Live</span>
                <span className="text-xl font-bold uppercase tracking-[0.18em] text-white/65">Caster cam</span>
            </div>
            <div className="absolute flex flex-col gap-[18px]" style={{ left: x + width + 64, right: 64, top: y - BEZEL }}>
                <p className="text-lg font-bold uppercase tracking-[0.3em] text-white/55">On the mic</p>
                {view.casters.map(caster => (
                    <CasterPlate key={caster.key} caster={caster} zoom={2.1} className="px-[26px] py-[22px]" />
                ))}
                {view.score && <SeriesScoreCard score={view.score} className="mt-2.5 w-full" />}
            </div>
        </div>
    )
}

function CastersOnly({ view }: { view: CasterView }) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-10">
            <p className="text-lg font-bold uppercase tracking-[0.3em] text-white/55">On the mic</p>
            <div className="flex items-stretch gap-10">
                {view.casters.map(caster => (
                    <CasterPlate key={caster.key} caster={caster} zoom={3.2} className="flex items-center px-11 py-[34px]" />
                ))}
            </div>
            {view.score && <SeriesScoreCard score={view.score} className="w-[900px]" />}
        </div>
    )
}

export default function CasterScene() {
    const { phase, state } = useSceneMatch()

    if (phase === 'loading') return <BlankFrame scene="caster" />
    if (state === null) return <IdleFrame scene="caster" />
    const view = casterView(state)

    return (
        <SceneFrame scene="caster" title="Casters" backdrop={!view.webcam}>
            {view.webcam ? <WebcamLayer view={view} /> : <CastersOnly view={view} />}
        </SceneFrame>
    )
}
