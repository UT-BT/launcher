import { CSSProperties } from 'react'
import { ActiveTitle } from '@/app/utils/api'

export function hasTitle(title?: ActiveTitle | null): title is ActiveTitle {
    return !!title && !!title.name
}

export function getReadableTitleColor(r: number, g: number, b: number): string {
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    if (brightness < 100) {
        return `rgb(${Math.min(255, r + 80)}, ${Math.min(255, g + 80)}, ${Math.min(255, b + 80)})`
    }
    if (brightness > 200) {
        return `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)})`
    }
    return `rgb(${r}, ${g}, ${b})`
}

export function getAvatarBorderStyle(title?: ActiveTitle | null): CSSProperties {
    const baseStyle: CSSProperties = {
        border: '1px solid rgba(255,255,255,0.15)',
    }
    if (!title || !title.rarity || title.rarity < 3) return baseStyle

    const { rarity, color_r, color_g, color_b } = title
    const titleColor = getReadableTitleColor(color_r, color_g, color_b)

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

export function getTitleTextStyle(title?: ActiveTitle | null): CSSProperties {
    if (!title || !title.rarity) {
        return { color: '#6c757d' }
    }

    const { rarity, color_r, color_g, color_b } = title
    const titleColor = getReadableTitleColor(color_r, color_g, color_b)
    const blackOutline =
        '0 0 1px rgba(0,0,0,1),' +
        '1px 0 1px rgba(0,0,0,1),' +
        '-1px 0 1px rgba(0,0,0,1),' +
        '0 1px 1px rgba(0,0,0,1),' +
        '0 -1px 1px rgba(0,0,0,1)'

    switch (rarity) {
        case 1:
            return { color: '#6c757d', fontWeight: 400 }
        case 2:
            return { color: titleColor, fontWeight: 500 }
        case 3:
            return {
                color: titleColor,
                fontWeight: 600,
                letterSpacing: '0.02em',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            }
        case 4:
            return {
                color: titleColor,
                fontWeight: 600,
                letterSpacing: '0.03em',
                textShadow: blackOutline,
            }
        case 5:
            return {
                color: titleColor,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textShadow: `${blackOutline}, 0 0 2px ${titleColor}`,
                animation: 'legendaryTitlePulse 2s ease-in-out infinite',
            }
        default:
            return { color: '#6c757d' }
    }
}
