import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SEASON_IDS } from '@/app/seasonal/seasons'

type Rgb = [number, number, number]
type Vars = Record<string, string>

const seasonsCss = readFileSync(resolve(__dirname, 'seasons.css'), 'utf8')
const themesCss = readFileSync(resolve(__dirname, 'themes.css'), 'utf8')
const globalsCss = readFileSync(resolve(__dirname, 'globals.css'), 'utf8')

const AA_TEXT = 4.5
const WHITE: Rgb = [1, 1, 1]
const ALLOWED_VARIABLE =
    /^--(accent-(50|[1-9]00|950)|accent-glow-rgb|nebula-[1-4]|background|card|popover|secondary|muted|accent|border|input|window-c-titlebar-background)$/
const SURFACES = ['--background', '--card'] as const
const FOREGROUNDS = ['--foreground', '--muted-foreground'] as const
const SEASONAL_BASE = ":root[data-theme='seasonal']"

function blocks(css: string): { selector: string; body: string }[] {
    return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => ({ selector: match[1].trim(), body: match[2] }))
}

function declarations(body: string): Vars {
    return Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]))
}

function toLinear(channel: number): number {
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

const SEPARATOR = String.raw`\s*[\s,]\s*`
const ALPHA = String.raw`(?:\s*[/,]\s*(?<alpha>[\d.]+)(?<alphaPercent>%?))?\s*`
const HSL = new RegExp(
    String.raw`^hsla?\(\s*(?<h>[\d.]+)(?:deg)?${SEPARATOR}(?<s>[\d.]+)%${SEPARATOR}(?<l>[\d.]+)%${ALPHA}\)$`
)
const RGB = new RegExp(String.raw`^rgba?\(\s*(?<r>[\d.]+)${SEPARATOR}(?<g>[\d.]+)${SEPARATOR}(?<b>[\d.]+)${ALPHA}\)$`)
const HEX = /^#([\da-f]{3}|[\da-f]{6})$/i
const OKLCH = new RegExp(
    String.raw`^oklch\(\s*(?<l>[\d.]+)(?<lPercent>%?)\s+(?<c>[\d.]+)\s+(?<h>[\d.]+)(?:deg)?${ALPHA}\)$`
)

function hslToLinear(h: number, s: number, l: number): Rgb {
    const sat = s / 100
    const light = l / 100
    const k = (n: number) => (n + h / 30) % 12
    const a = sat * Math.min(light, 1 - light)
    const channel = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
    return [channel(0), channel(8), channel(4)].map(toLinear) as Rgb
}

function hexToLinear(value: string): Rgb {
    const digits = value.slice(1)
    const full = digits.length === 3 ? [...digits].map(digit => digit + digit).join('') : digits
    return [0, 2, 4].map(index => toLinear(parseInt(full.slice(index, index + 2), 16) / 255)) as Rgb
}

function oklchToLinear(l: number, c: number, h: number): Rgb {
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

function opaqueGroups(pattern: RegExp, value: string, where: string): Record<string, string | undefined> | undefined {
    const groups = value.match(pattern)?.groups
    if (groups?.alpha !== undefined && Number(groups.alpha) / (groups.alphaPercent ? 100 : 1) < 1) {
        throw new Error(`${where}: "${value}" is translucent; write it opaque so its contrast can be measured`)
    }
    return groups
}

function colorToLinear(value: string | undefined, where: string): Rgb {
    if (value === undefined) throw new Error(`${where} is not set`)
    const hsl = opaqueGroups(HSL, value, where)
    if (hsl) return hslToLinear(Number(hsl.h), Number(hsl.s), Number(hsl.l))
    const rgb = opaqueGroups(RGB, value, where)
    if (rgb) return [rgb.r, rgb.g, rgb.b].map(channel => toLinear(Number(channel) / 255)) as Rgb
    if (HEX.test(value)) return hexToLinear(value)
    const oklch = opaqueGroups(OKLCH, value, where)
    if (oklch) return oklchToLinear(Number(oklch.l) / (oklch.lPercent ? 100 : 1), Number(oklch.c), Number(oklch.h))
    throw new Error(`${where}: cannot read the colour "${value}"; write it as hsl(), rgb(), #hex or oklch()`)
}

function luminance([r, g, b]: Rgb): number {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: Rgb, b: Rgb): number {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (light + 0.05) / (dark + 0.05)
}

const seasonBlocks = blocks(seasonsCss)
const classic = declarations(blocks(themesCss).find(block => block.selector === ':root')!.body)
const seasonalBase = declarations(blocks(themesCss).find(block => block.selector === SEASONAL_BASE)!.body)
const globalTokens = declarations(blocks(globalsCss).find(block => block.selector === ':root' && /--foreground\s*:/.test(block.body))!.body)

function entrySelector(id: string): string {
    return `${SEASONAL_BASE}[data-season='${id}']`
}

function entryBlock(id: string): Vars {
    const block = seasonBlocks.find(candidate => candidate.selector === entrySelector(id))
    if (!block) throw new Error(`no ${entrySelector(id)} block in seasons.css`)
    return declarations(block.body)
}

function resolved(own: Vars): Vars {
    return { ...globalTokens, ...seasonalBase, ...own }
}

function accentTextRatios(vars: Vars, where: string): { name: string; ratio: number }[] {
    const background = colorToLinear(vars['--background'], `${where} --background`)
    return [
        ...['200', '300', '400'].map(step => ({
            name: `accent-${step} text on the background`,
            ratio: contrast(colorToLinear(vars[`--accent-${step}`], `${where} --accent-${step}`), background),
        })),
        { name: 'white text on accent-500', ratio: contrast(WHITE, colorToLinear(vars['--accent-500'], `${where} --accent-500`)) },
    ]
}

const classicFloors = accentTextRatios(classic, 'Classic').map(pair => Math.min(AA_TEXT, pair.ratio))

const palettes: [string, () => Vars][] = [
    ['the Seasonal base', () => resolved({})],
    ...SEASON_IDS.map(id => [id, () => resolved(entryBlock(id))] as [string, () => Vars]),
]

describe('seasonal palettes', () => {
    it('are one Seasonal theme block per registry entry, with no other selector', () => {
        expect(seasonBlocks.map(block => block.selector).sort()).toEqual(SEASON_IDS.map(entrySelector).sort())
    })

    it.each(SEASON_IDS)('%s sets only the accent, glow, nebula, surfaces and titlebar background', id => {
        for (const name of Object.keys(entryBlock(id))) {
            expect(name, id).toMatch(ALLOWED_VARIABLE)
        }
    })

    it.each(SEASON_IDS)('%s writes any background and card it sets as an opaque colour the contrast checks can read', id => {
        const own = entryBlock(id)
        for (const name of SURFACES.filter(surface => surface in own)) {
            expect(colorToLinear(own[name], `${id} ${name}`).every(Number.isFinite)).toBe(true)
        }
    })

    it.each(palettes)('%s keeps accent text and white on accent-500 at AA, or at least as legible as Classic', (name, vars) => {
        accentTextRatios(vars(), name).forEach((pair, index) => {
            expect(pair.ratio, `${name}: ${pair.name}`).toBeGreaterThanOrEqual(classicFloors[index])
        })
    })

    it.each(palettes)('%s keeps foreground and muted-foreground at AA on its own background and card', (name, vars) => {
        const values = vars()
        for (const surface of SURFACES) {
            const behind = colorToLinear(values[surface], `${name} ${surface}`)
            for (const foreground of FOREGROUNDS) {
                const ratio = contrast(colorToLinear(values[foreground], `${name} ${foreground}`), behind)
                expect(ratio, `${name}: ${foreground} on ${surface}`).toBeGreaterThanOrEqual(AA_TEXT)
            }
        }
    })
})

describe('seasonal surface parsing', () => {
    it.each(['hsl(0 0% 100%)', 'hsl(0, 0%, 100%)', 'hsla(0, 0%, 100%, 100%)', '#fff', 'rgb(255 255 255)', 'oklch(1 0 0)', 'oklch(100% 0 0)'])(
        'reads %s as white',
        value => {
            expect(luminance(colorToLinear(value, 'probe'))).toBeCloseTo(1, 4)
        }
    )

    it.each(['var(--card)', 'color-mix(in srgb, red, blue)', 'lab(50% 0 0)', '#12'])('fails on %s instead of skipping the block', value => {
        expect(() => colorToLinear(value, 'probe --background')).toThrow(/probe --background.*cannot read/)
    })

    it.each(['hsl(0 0% 4% / 0.9)', 'rgba(0, 0, 0, 0.5)', 'oklch(0.2 0 0 / 50%)'])('fails on the translucent %s', value => {
        expect(() => colorToLinear(value, 'probe --card')).toThrow(/probe --card.*translucent/)
    })

    it('scores the global foreground tokens the inherited surfaces sit under', () => {
        expect(FOREGROUNDS.every(name => name in globalTokens)).toBe(true)
    })
})
