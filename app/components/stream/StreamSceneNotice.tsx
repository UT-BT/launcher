import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { STREAM_SCENES, isTransparentStreamScene, type StreamSceneId } from './streamScenes'

function StreamNotice({ transparent, children }: { transparent: boolean; children: ReactNode }) {
    return (
        <main
            className={cn(
                'flex h-full w-full items-center justify-center p-8 text-center text-foreground',
                !transparent && 'bg-background'
            )}
        >
            {children}
        </main>
    )
}

export function ScenePlaceholder({ scene }: { scene: StreamSceneId }) {
    const label = STREAM_SCENES.find(entry => entry.id === scene)?.label ?? scene
    return (
        <StreamNotice transparent={isTransparentStreamScene(scene)}>
            <div data-stream-scene={scene} className="flex flex-col gap-2 rounded-xl bg-black/60 px-10 py-8">
                <h1 className="text-5xl font-semibold">{label}</h1>
                <p className="text-xl text-muted-foreground">Scene coming soon</p>
            </div>
        </StreamNotice>
    )
}

export function UnknownScene({ scene }: { scene: string }) {
    return (
        <StreamNotice transparent={false}>
            <div data-stream-scene-unknown={scene} className="flex max-w-3xl flex-col gap-3">
                <h1 className="text-4xl font-semibold">Unknown scene</h1>
                <p className="break-all text-lg text-muted-foreground">
                    “{scene}” is not a stream scene. Scenes: {STREAM_SCENES.map(entry => entry.id).join(', ')}.
                </p>
            </div>
        </StreamNotice>
    )
}
