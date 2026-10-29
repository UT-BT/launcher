import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SEASON_IDS } from '@/app/seasonal/seasons'

type Rgb = [number, number, number]

const seasonsCss = readFileSync(resolve(__dirname, 'seasons.css'), 'utf8')
const themesCss = readFileSync(resolve(__dirname, 'themes.css'), 'utf8')

const AA_TEXT = 4.5
const WHITE: Rgb = [1, 1, 1]
const ALLOWED_VARIABLE = /^--(accent-(50|[1-9]00|950)|accent-glow-rgb|nebula-[1-4])$/

function blocks(css: string): { selector: string; body: string }[] {
    return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => ({ selector: match[1].trim(), body: match[2] }))
}

function declarations(body: string): Record<string, string> {
    return Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]))
}

function toLinear(channel: number): number {
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function hslToLinear(value: string): Rgb {
    const [h, s, l] = value.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/)!.slice(1).map(Number)
    const sat = s / 100
    const light = l / 100
    const k = (n: number) => (n + h / 30) % 12
    const a = sat * Math.min(light, 1 - light)
    const channel = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
    return [channel(0), channel(8), channel(4)].map(toLinear) as Rgb
}

function oklchToLinear(value: string): Rgb {
    const [l, c, h] = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/)!.slice(1).map(Number)
    const a = c * Math.cos((h * Math.PI) / 180)
    const b = c * Math.sin((h * Math.PI) / 180)
    const lms = [
        (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
        (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
        (l - 0.0894841775 * a - 1.291485548 * b) ** 3,
    ]
    const clamp = (channel: number) => Math.min(1, Math.max(0, channel))
    return [
        clamp(4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2]),
        clamp(-1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2]),
        clamp(-0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2]),
    ]
}

function luminance([r, g, b]: Rgb): number {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: Rgb, b: Rgb): number {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (light + 0.05) / (dark + 0.05)
}

const classic = declarations(blocks(themesCss).find(block => block.selector === ':root')!.body)
const background = hslToLinear(classic['--background'])

function seasonBlock(id: string) {
    return blocks(seasonsCss).find(block => block.selector === `:root[data-season='${id}']:not([data-theme])`)
}

function pairs(vars: Record<string, string>): { name: string; ratio: number }[] {
    return [
        ...['200', '300', '400'].map(step => ({
            name: `accent-${step} text on the background`,
            ratio: contrast(oklchToLinear(vars[`--accent-${step}`]), background),
        })),
        { name: 'white text on accent-500', ratio: contrast(WHITE, oklchToLinear(vars['--accent-500'])) },
    ]
}

const classicPairs = pairs(classic)

describe('seasonal palettes', () => {
    it('only ever target the Classic theme', () => {
        for (const block of blocks(seasonsCss)) {
            expect(block.selector).toMatch(/^:root\[data-season='(halloween|christmas|easter)'\]:not\(\[data-theme\]\)$/)
        }
    })

    it.each(SEASON_IDS)('%s has a palette', id => {
        expect(seasonBlock(id)).toBeDefined()
    })

    it.each(SEASON_IDS)('%s only retints the brand accent, never a semantic color', id => {
        for (const name of Object.keys(declarations(seasonBlock(id)!.body))) {
            expect(name).toMatch(ALLOWED_VARIABLE)
        }
    })

    it.each(SEASON_IDS)('%s keeps text at AA, or at least as legible as Classic', id => {
        const seasonal = pairs(declarations(seasonBlock(id)!.body))
        seasonal.forEach((pair, index) => {
            const floor = Math.min(AA_TEXT, classicPairs[index].ratio)
            expect(pair.ratio, `${id}: ${pair.name}`).toBeGreaterThanOrEqual(floor)
        })
    })
})
