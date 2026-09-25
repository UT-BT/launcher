import type { PickBanSoundSchedule } from './pickBanSoundCues'
import { SOUND_URLS, type PickBanSoundCueKind } from './pickBanSounds'

export interface PickBanSoundPlayer {
    preload: () => Promise<void>
    unlock: () => void
    play: (kind: PickBanSoundCueKind, schedule: PickBanSoundSchedule) => void
    dispose: () => void
}

interface AudioGraph {
    context: AudioContext
    master: GainNode
}

const MASTER_GAIN = 0.9

function audioContextCtor(): typeof AudioContext | undefined {
    return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
}

export function createPickBanSoundPlayer(): PickBanSoundPlayer {
    let graph: AudioGraph | null = null
    const buffers = new Map<PickBanSoundCueKind, AudioBuffer>()

    function ensureGraph(): AudioGraph | null {
        if (graph) return graph
        const Ctor = audioContextCtor()
        if (!Ctor) return null
        const context = new Ctor()
        const master = context.createGain()
        master.gain.value = MASTER_GAIN
        master.connect(context.destination)
        graph = { context, master }
        return graph
    }

    async function decode(ctx: AudioContext, kind: PickBanSoundCueKind): Promise<void> {
        if (buffers.has(kind)) return
        const response = await fetch(SOUND_URLS[kind])
        const arrayBuffer = await response.arrayBuffer()
        const buffer = await ctx.decodeAudioData(arrayBuffer)
        buffers.set(kind, buffer)
    }

    return {
        async preload() {
            const ctx = ensureGraph()?.context
            if (!ctx) return
            await Promise.all((Object.keys(SOUND_URLS) as PickBanSoundCueKind[]).map((kind) => decode(ctx, kind).catch(() => undefined)))
        },
        unlock() {
            const ctx = ensureGraph()?.context
            if (ctx?.state === 'suspended') ctx.resume().catch(() => undefined)
        },
        play(kind, schedule) {
            const audio = ensureGraph()
            const buffer = buffers.get(kind)
            if (!audio || !buffer || audio.context.state !== 'running') return
            try {
                const source = audio.context.createBufferSource()
                source.buffer = buffer
                source.connect(audio.master)
                source.start(audio.context.currentTime + schedule.delayMs / 1000, schedule.offsetMs / 1000)
            } catch {
                return
            }
        },
        dispose() {
            const audio = graph
            graph = null
            buffers.clear()
            if (audio && audio.context.state !== 'closed') audio.context.close().catch(() => undefined)
        },
    }
}
