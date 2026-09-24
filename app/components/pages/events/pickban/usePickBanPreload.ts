import { useEffect, useState } from 'react'
import { nextScreenshotStage, screenshotUrlFor, type ScreenshotStage } from '@/app/utils/mapScreenshots'
import type { PickBanCardView } from './pickBanView'

export type PickBanPreloadCard = Pick<PickBanCardView, 'map' | 'screenshotVersion' | 'state'>

type PreloadTarget = [map: string, version: string | null]

const PRELOADED_FONT_WEIGHTS = [600, 700, 800, 900]

function decodeInto(url: string, kept: HTMLImageElement[]): Promise<boolean> {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    return image.decode().then(
        () => {
            kept.push(image)
            return true
        },
        () => false,
    )
}

async function preloadScreenshot([map, version]: PreloadTarget, kept: HTMLImageElement[]): Promise<void> {
    let stage: ScreenshotStage = 'derived'
    while (!(await decodeInto(screenshotUrlFor(stage, map, 'card', version), kept))) {
        if (stage === 'default') return
        stage = nextScreenshotStage(stage)
    }
}

async function preloadFonts(): Promise<void> {
    const fonts = document.fonts
    if (!fonts) return
    const families = [
        getComputedStyle(document.body).fontFamily,
        getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim(),
    ].filter(Boolean)
    await Promise.all(families.flatMap(family => PRELOADED_FONT_WEIGHTS.map(weight => fonts.load(`${weight} 1em ${family}`).catch(() => []))))
    await fonts.ready
}

function targetsKeyOf(cards: readonly PickBanPreloadCard[] | null | undefined): string {
    const targets: PreloadTarget[] = (cards ?? [])
        .filter(card => card.state !== 'excluded')
        .map(card => [card.map, card.screenshotVersion])
    return JSON.stringify(targets)
}

export function usePickBanPreload(cards: readonly PickBanPreloadCard[] | null | undefined): boolean {
    const targetsKey = targetsKeyOf(cards)
    const [readyKey, setReadyKey] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        const kept: HTMLImageElement[] = []
        const targets = JSON.parse(targetsKey) as PreloadTarget[]
        void Promise.all([preloadFonts().catch(() => undefined), ...targets.map(target => preloadScreenshot(target, kept))])
            .then(() => {
                if (!cancelled) setReadyKey(targetsKey)
            })
        return () => {
            cancelled = true
            kept.length = 0
        }
    }, [targetsKey])

    return readyKey === targetsKey
}
