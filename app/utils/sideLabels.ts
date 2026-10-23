import type { PickBanActor, SideColor } from '@/app/utils/api'
import type { PickBanTone } from '@/app/components/broadcast/broadcastTone'

export const SIDES_TBC = 'Sides TBC'

const COLOR_NAMES: Record<SideColor, string> = { red: 'Red', blue: 'Blue' }

const COLOR_LETTERS: Record<SideColor, PickBanActor> = { red: 'A', blue: 'B' }

const COLOR_TONES: Record<SideColor, PickBanTone> = { red: 'a', blue: 'b' }

export function sideColorName(color: SideColor): string {
    return COLOR_NAMES[color]
}

export function sideColorTag(color: SideColor): string {
    return COLOR_NAMES[color].toUpperCase()
}

export function sideLetterOf(color: SideColor): PickBanActor {
    return COLOR_LETTERS[color]
}

export function sideColorOfLetter(letter: PickBanActor): SideColor {
    return letter === 'A' ? 'red' : 'blue'
}

export function otherSideColor(color: SideColor): SideColor {
    return color === 'red' ? 'blue' : 'red'
}

export function sideColorTitle(color: SideColor): string {
    return `${sideColorName(color)} · Side ${sideLetterOf(color)}`
}

export function sideColorTone(color: SideColor): PickBanTone {
    return COLOR_TONES[color]
}

export function withSideColor(name: string, color: SideColor | null): string {
    if (color === null || name === sideColorName(color)) return name
    return `${name} (${sideColorName(color)})`
}

export function sideTagOf(color: SideColor | null, confirmed: boolean): string {
    return color !== null && confirmed ? sideColorTag(color) : SIDES_TBC
}

export function youreSideLabel(color: SideColor | null): string | null {
    return color === null ? null : `You’re ${sideColorName(color)}`
}
