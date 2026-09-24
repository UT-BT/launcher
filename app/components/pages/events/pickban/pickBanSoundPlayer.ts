import banUrl from '@/app/assets/sounds/ban.wav'
import deciderUrl from '@/app/assets/sounds/decider.wav'
import lockInUrl from '@/app/assets/sounds/lock-in.wav'
import type { PickBanSoundCueKind } from './pickBanSoundCues'

export interface PickBanSoundPlayer {
    preload: () => Promise<void>
    unlock: () => void
    play: (kind: PickBanSoundCueKind) => void
    dispose: () => void
}

const SOUND_URLS: { [kind in PickBanSoundCueKind]: string } = {
    lock_in: lockInUrl,
    ban: banUrl,
    decider: deciderUrl,
}

function audioContextCtor(): typeof AudioContext | undefined {
    return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
}

export function createPickBanSoundPlayer(): PickBanSoundPlayer {
    let context: AudioContext | null = null
    const buffers = new Map<PickBanSoundCueKind, AudioBuffer>()

    function ensureContext(): AudioContext | null {
        if (context) return context
        const Ctor = audioContextCtor()
        if (!Ctor) return null
        context = new Ctor()
        return context
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
            const ctx = ensureContext()
            if (!ctx) return
            await Promise.all((Object.keys(SOUND_URLS) as PickBanSoundCueKind[]).map((kind) => decode(ctx, kind).catch(() => undefined)))
        },
        unlock() {
            const ctx = ensureContext()
            if (ctx?.state === 'suspended') ctx.resume().catch(() => undefined)
        },
        play(kind) {
            const ctx = ensureContext()
            const buffer = buffers.get(kind)
            if (!ctx || !buffer) return
            try {
                const source = ctx.createBufferSource()
                source.buffer = buffer
                source.connect(ctx.destination)
                source.start()
            } catch {
                return
            }
        },
        dispose() {
            const ctx = context
            context = null
            buffers.clear()
            if (ctx && ctx.state !== 'closed') ctx.close().catch(() => undefined)
        },
    }
}
