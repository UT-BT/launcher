import { CSSProperties } from 'react'
import { ActiveTitle } from '@/app/utils/api'

export function hasTitle(title?: ActiveTitle | null): title is ActiveTitle {
    return !!title && !!title.name
}

function isLightTheme(): boolean {
    return typeof document !== 'undefined'
        && document.documentElement.getAttribute('data-theme') === 'light'
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2
    const d = max - min
    if (d === 0) return [0, 0, l]
    const s = d / (1 - Math.abs(2 * l - 1))
    let h: number
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
    return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
    const m = l - c / 2
    let r = 0, g = 0, b = 0
    if (h < 60) { r = c; g = x }
    else if (h < 120) { r = x; g = c }
    else if (h < 180) { g = c; b = x }
    else if (h < 240) { g = x; b = c }
    else if (h < 300) { r = x; b = c }
    else { r = c; b = x }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

function relativeLuminance(r: number, g: number, b: number): number {
    const channel = (c: number) => {
        const v = c / 255
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function titleColorForLight(r: number, g: number, b: number): string {
    const [h, s0, l0] = rgbToHsl(r, g, b)
    const s = Math.min(1, s0 + 0.12)
    let l = Math.min(l0, 0.45)
    let rgb = hslToRgb(h, s, l)
    let guard = 0
    while (relativeLuminance(rgb[0], rgb[1], rgb[2]) > 0.2 && l > 0.18 && guard++ < 24) {
        l -= 0.03
        rgb = hslToRgb(h, s, l)
    }
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
}

export function getReadableTitleColor(r: number, g: number, b: number, light: boolean = isLightTheme()): string {
    if (light) {
        return titleColorForLight(r, g, b)
    }
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    if (brightness < 100) {
        return `rgb(${Math.min(255, r + 80)}, ${Math.min(255, g + 80)}, ${Math.min(255, b + 80)})`
    }
    if (brightness > 200) {
        return `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)})`
    }
    return `rgb(${r}, ${g}, ${b})`
}

export function getAvatarBorderStyle(title?: ActiveTitle | null, light: boolean = isLightTheme()): CSSProperties {
    const baseStyle: CSSProperties = {
        border: `1px solid ${light ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.15)'}`,
    }
    if (!title || !title.rarity || title.rarity < 3) return baseStyle

    const { rarity, color_r, color_g, color_b } = title
    const titleColor = getReadableTitleColor(color_r, color_g, color_b, light)

    switch (rarity) {
        case 3:
            return {
                border: `1px solid ${titleColor}`,
                boxShadow: `0 0 2px rgba(${color_r}, ${color_g}, ${color_b}, 0.15)`,
            }
        case 4:
            return {
                border: `1px solid ${titleColor}`,
                boxShadow: `0 0 3px rgba(${color_r}, ${color_g}, ${color_b}, 0.2)`,
            }
        case 5:
            return {
                border: `1px solid ${titleColor}`,
                boxShadow: `0 0 4px rgba(${color_r}, ${color_g}, ${color_b}, 0.3), 0 0 8px rgba(${color_r}, ${color_g}, ${color_b}, 0.15)`,
                animation: 'legendaryAvatarPulse 2s ease-in-out infinite',
            }
        default:
            return baseStyle
    }
}

export function getTitleTextStyle(title?: ActiveTitle | null, light: boolean = isLightTheme()): CSSProperties {
    if (!title || !title.rarity) {
        return { color: light ? '#64748b' : '#6c757d' }
    }

    const { rarity, color_r, color_g, color_b } = title
    const titleColor = getReadableTitleColor(color_r, color_g, color_b, light)
    const blackOutline =
        '0 0 1px rgba(0,0,0,1),' +
        '1px 0 1px rgba(0,0,0,1),' +
        '-1px 0 1px rgba(0,0,0,1),' +
        '0 1px 1px rgba(0,0,0,1),' +
        '0 -1px 1px rgba(0,0,0,1)'

    switch (rarity) {
        case 1:
            return { color: light ? '#64748b' : '#6c757d', fontWeight: 400 }
        case 2:
            return { color: titleColor, fontWeight: 500 }
        case 3:
            return {
                color: titleColor,
                fontWeight: 600,
                letterSpacing: '0.02em',
                textShadow: light ? undefined : '0 1px 2px rgba(0,0,0,0.5)',
            }
        case 4:
            return {
                color: titleColor,
                fontWeight: 600,
                letterSpacing: '0.03em',
                textShadow: light ? undefined : blackOutline,
            }
        case 5:
            return {
                color: titleColor,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textShadow: light ? undefined : `${blackOutline}, 0 0 2px ${titleColor}`,
                animation: 'legendaryTitlePulse 2s ease-in-out infinite',
            }
        default:
            return { color: light ? '#64748b' : '#6c757d' }
    }
}
