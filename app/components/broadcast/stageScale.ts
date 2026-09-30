export const STAGE_WIDTH = 1920
export const STAGE_HEIGHT = 1080

export function computeStageScale(viewportWidth: number, viewportHeight: number): number {
    if (viewportWidth <= 0 || viewportHeight <= 0) return 1
    return Math.min(viewportWidth / STAGE_WIDTH, viewportHeight / STAGE_HEIGHT)
}
