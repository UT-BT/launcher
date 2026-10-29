import { Component, lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import type { LucideProps } from 'lucide-react'
import { useSeason } from './SeasonProvider'
import type { SeasonId } from './seasons'

type DecorModule = typeof import('./SeasonalDecor')

const DECOR_CHUNK = 'SeasonalDecor'

let decorModule: Promise<DecorModule | null> | null = null

function loadDecor(): Promise<DecorModule | null> {
    decorModule ??= import('./SeasonalDecor').catch(() => null)
    return decorModule
}

export function isSeasonalDecorChunkError(error: unknown): boolean {
    return error instanceof Error && error.message.includes(DECOR_CHUNK)
}

function Nothing() {
    return null
}

function lazyDecor<Name extends keyof DecorModule>(name: Name) {
    return lazy(async () => {
        const module = await loadDecor()
        return { default: (module ? module[name] : Nothing) as ComponentType<Parameters<DecorModule[Name]>[0]> }
    })
}

class SilentBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
    state = { failed: false }

    static getDerivedStateFromError() {
        return { failed: true }
    }

    render() {
        return this.state.failed ? (this.props.fallback ?? null) : this.props.children
    }
}

const LazyAmbient = lazyDecor('AmbientLayer')
const LazyGlyph = lazyDecor('SeasonGlyph')

export function fireSeasonalBurst(season: SeasonId, x: number, y: number): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    void loadDecor().then(module => module?.fireBurst(season, x, y))
}

export function SeasonalAmbient() {
    const season = useSeason()
    if (!season) return null
    return (
        <SilentBoundary>
            <Suspense fallback={null}>
                <LazyAmbient season={season} />
            </Suspense>
        </SilentBoundary>
    )
}

export function SeasonalSpinnerGlyph({ fallback, ...props }: LucideProps & { fallback: ReactNode }) {
    const season = useSeason()
    if (!season) return fallback
    return (
        <SilentBoundary fallback={fallback}>
            <Suspense fallback={fallback}>
                <LazyGlyph season={season} {...props} />
            </Suspense>
        </SilentBoundary>
    )
}
