export type OverlayMapState = 'played' | 'current' | 'upcoming' | 'skipped'

export const SCORE_ROW = { width: 376, height: 46 }
export const STAGE_WIDTH = 1920
export const SEAM_Y = 540
export const NAME_TAG = { width: 300, height: 60 }
export const SEAM_RAIL = { thickness: 3, gapPx: 6, fadePx: 220 }
export const BAND = { maxWidth: 560, height: 30, paddingX: 4 }
export const LONG_TEAM_NAME_CHARS = 15

export const MAP_NAME_MAX_PX = {
    played: 110,
    current: null,
    upcoming: 140,
    skipped: 110,
} satisfies Record<OverlayMapState, number | null>

export const UPCOMING_NAME_MIN_PX = 40

export const STRIP_ESTIMATE = {
    charPx: 8,
    cellPaddingPx: 23,
    gapPx: 7,
    badgePx: 17,
    resultPaddingPx: 4,
    chipPaddingPx: 14,
    chipGapPx: 6,
}
