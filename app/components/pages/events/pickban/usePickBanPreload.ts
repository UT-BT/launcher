import { useEffect } from 'react'
import { nextScreenshotStage, screenshotUrlFor, type MapThumbnailSize, type ScreenshotStage } from '@/app/utils/mapScreenshots'
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

const CORE_SIZES: MapThumbnailSize[] = ['card']

async function preloadScreenshot([map, version]: PreloadTarget, size: MapThumbnailSize, kept: HTMLImageElement[]): Promise<void> {
    let stage: ScreenshotStage = 'derived'
    while (!(await decodeInto(screenshotUrlFor(stage, map, size, version), kept))) {
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

export function usePickBanPreload(cards: readonly PickBanPreloadCard[] | null | undefined, sizes: readonly MapThumbnailSize[] = CORE_SIZES): void {
    const targetsKey = targetsKeyOf(cards)
    const sizesKey = sizes.join(',')

    useEffect(() => {
        const kept: HTMLImageElement[] = []
        void preloadFonts().catch(() => undefined)
        for (const target of JSON.parse(targetsKey) as PreloadTarget[]) {
            for (const size of sizesKey.split(',') as MapThumbnailSize[]) void preloadScreenshot(target, size, kept)
        }
        return () => {
            kept.length = 0
        }
    }, [targetsKey, sizesKey])
}
