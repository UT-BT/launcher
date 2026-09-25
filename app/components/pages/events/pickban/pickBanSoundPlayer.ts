import type { PickBanSoundSchedule } from './pickBanSoundCues'
import { SOUND_PACKS, type PickBanSoundCueKind, type PickBanSoundPack } from './pickBanSounds'

export interface PickBanSoundPlayer {
    preload: () => Promise<void>
    unlock: () => void
    setPack: (pack: PickBanSoundPack) => void
    setVolume: (volume: number) => void
    play: (kind: PickBanSoundCueKind, schedule: PickBanSoundSchedule) => void
    preview: (kind: PickBanSoundCueKind, pack: PickBanSoundPack) => void
    dispose: () => void
}

export interface PickBanSoundPlayerSettings {
    pack: PickBanSoundPack
    volume: number
}

interface AudioGraph {
    context: AudioContext
    master: GainNode
}

interface PreviewVoice {
    source: AudioBufferSourceNode
    fader: GainNode
}

const VOLUME_RAMP_S = 0.06

const PREVIEW_FADE_S = 0.02

function audioContextCtor(): typeof AudioContext | undefined {
    return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
}

export function masterGainOf(volume: number): number {
    const level = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0
    return level * level
}

export function createPickBanSoundPlayer(settings: PickBanSoundPlayerSettings): PickBanSoundPlayer {
    let graph: AudioGraph | null = null
    let pack = settings.pack
    let gain = masterGainOf(settings.volume)
    let previewToken = 0
    let previewVoice: PreviewVoice | null = null
    const buffers = new Map<string, AudioBuffer>()
    const loads = new Map<string, Promise<AudioBuffer | null>>()

    function ensureGraph(): AudioGraph | null {
        if (graph) return graph
        const Ctor = audioContextCtor()
        if (!Ctor) return null
        const context = new Ctor()
        const master = context.createGain()
        master.gain.value = gain
        master.connect(context.destination)
        graph = { context, master }
        return graph
    }

    function load(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
        const pending = loads.get(url)
        if (pending) return pending
        const loading = fetch(url)
            .then((response) => response.arrayBuffer())
            .then((data) => ctx.decodeAudioData(data))
            .then((buffer) => {
                if (graph?.context === ctx) buffers.set(url, buffer)
                return buffer
            })
            .catch(() => {
                if (loads.get(url) === loading) loads.delete(url)
                return null
            })
        loads.set(url, loading)
        return loading
    }

    function loadPack(ctx: AudioContext, which: PickBanSoundPack): Promise<unknown> {
        return Promise.all(Object.values(SOUND_PACKS[which]).map((url) => load(ctx, url)))
    }

    function sourceOf(audio: AudioGraph, buffer: AudioBuffer, destination: AudioNode): AudioBufferSourceNode {
        const source = audio.context.createBufferSource()
        source.buffer = buffer
        source.connect(destination)
        return source
    }

    function fadeOutPreview(audio: AudioGraph): void {
        const voice = previewVoice
        previewVoice = null
        if (!voice) return
        const now = audio.context.currentTime
        try {
            voice.fader.gain.setTargetAtTime(0, now, PREVIEW_FADE_S)
            voice.source.stop(now + PREVIEW_FADE_S * 6)
        } catch {
            return
        }
    }

    function startPreview(audio: AudioGraph, buffer: AudioBuffer): void {
        fadeOutPreview(audio)
        try {
            const fader = audio.context.createGain()
            fader.connect(audio.master)
            const source = sourceOf(audio, buffer, fader)
            source.start()
            previewVoice = { source, fader }
        } catch {
            return
        }
    }

    return {
        async preload() {
            const ctx = ensureGraph()?.context
            if (!ctx) return
            await loadPack(ctx, pack)
        },
        unlock() {
            const ctx = ensureGraph()?.context
            if (ctx?.state === 'suspended') ctx.resume().catch(() => undefined)
        },
        setPack(next) {
            if (next === pack) return
            pack = next
            const ctx = graph?.context
            if (ctx) void loadPack(ctx, next)
        },
        setVolume(volume) {
            gain = masterGainOf(volume)
            const audio = graph
            if (!audio) return
            const param = audio.master.gain
            const now = audio.context.currentTime
            param.cancelScheduledValues(now)
            param.setValueAtTime(param.value, now)
            param.linearRampToValueAtTime(gain, now + VOLUME_RAMP_S)
        },
        play(kind, schedule) {
            const audio = graph
            const buffer = buffers.get(SOUND_PACKS[pack][kind])
            if (!audio || !buffer || audio.context.state !== 'running') return
            try {
                sourceOf(audio, buffer, audio.master).start(audio.context.currentTime + schedule.delayMs / 1000, schedule.offsetMs / 1000)
            } catch {
                return
            }
        },
        preview(kind, which) {
            const audio = ensureGraph()
            if (!audio) return
            const token = ++previewToken
            const resumed = audio.context.state === 'suspended' ? audio.context.resume() : Promise.resolve()
            Promise.all([load(audio.context, SOUND_PACKS[which][kind]), resumed])
                .then(([buffer]) => {
                    if (buffer && token === previewToken && graph === audio && audio.context.state === 'running') startPreview(audio, buffer)
                })
                .catch(() => undefined)
        },
        dispose() {
            const audio = graph
            graph = null
            previewToken += 1
            previewVoice = null
            buffers.clear()
            loads.clear()
            if (audio && audio.context.state !== 'closed') audio.context.close().catch(() => undefined)
        },
    }
}
