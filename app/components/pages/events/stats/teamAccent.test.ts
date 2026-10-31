import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME_ID, THEMES } from '../../../../theme/themes'
import { ACCENT_SLOT_COUNT } from './statsView'
import { teamAccentColor, teamAccentStyle } from './teamAccent'

type Rgb = [number, number, number]

const accentsCss = readFileSync(resolve(__dirname, 'teamAccents.css'), 'utf8')
const themesCss = readFileSync(resolve(__dirname, '../../../../styles/themes.css'), 'utf8')
const themeCss = readFileSync(resolve(__dirname, '../../../../styles/theme.css'), 'utf8')

const MIN_TEXT_CONTRAST = 4.5
const MIN_HUE_DISTANCE = 25
const CHROMATIC = 0.06

function blocks(css: string): { selector: string; body: string }[] {
    return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => ({ selector: match[1].trim(), body: match[2] }))
}

function declarations(body: string): Record<string, string> {
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

type Oklch = { l: number; c: number; h: number }
type ColorGroups = Record<string, string | undefined>

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

function oklchOf(groups: ColorGroups): Oklch {
    return { l: Number(groups.l) / (groups.lPercent ? 100 : 1), c: Number(groups.c), h: Number(groups.h) }
}

function parseOklch(value: string): Oklch {
    return oklchOf(value.match(OKLCH)!.groups!)
}

function opaqueGroups(pattern: RegExp, value: string, where: string): ColorGroups | undefined {
    const groups = value.match(pattern)?.groups
    if (groups?.alpha !== undefined && Number(groups.alpha) / (groups.alphaPercent ? 100 : 1) < 1) {
        throw new Error(`${where}: "${value}" is translucent; write the surface opaque so its contrast can be measured`)
    }
    return groups
}

function colorToLinear(value: string, where: string): Rgb {
    const hsl = opaqueGroups(HSL, value, where)
    if (hsl) return hslToLinear(Number(hsl.h), Number(hsl.s), Number(hsl.l))
    const rgb = opaqueGroups(RGB, value, where)
    if (rgb) return [rgb.r, rgb.g, rgb.b].map(channel => toLinear(Number(channel) / 255)) as Rgb
    if (HEX.test(value)) return hexToLinear(value)
    const oklch = opaqueGroups(OKLCH, value, where)
    if (oklch) return oklchToLinear(oklchOf(oklch))
    throw new Error(`${where}: cannot read the colour "${value}"; write it as hsl(), rgb(), #hex or oklch()`)
}

function oklchToLinear({ l, c, h }: Oklch): Rgb {
    const a = c * Math.cos((h * Math.PI) / 180)
    const b = c * Math.sin((h * Math.PI) / 180)
    const lms = [
        (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
        (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
        (l - 0.0894841775 * a - 1.291485548 * b) ** 3,
    ]
    return [
        4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
        -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
        -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
    ]
}

function linearToOklchHue([r, g, b]: Rgb): number {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
    const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    return ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360
}

function luminance([r, g, b]: Rgb): number {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: Rgb, b: Rgb): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
}

function hueDistance(a: number, b: number): number {
    const d = Math.abs(a - b) % 360
    return Math.min(d, 360 - d)
}

const accentBlocks = blocks(accentsCss)
const darkAccents = declarations(accentBlocks.find(block => block.selector === ':root')!.body)
const lightAccents = declarations(accentBlocks.find(block => block.selector === ":root[data-theme='light']")!.body)

const themeBlocks = blocks(themesCss).filter(block => /^:root(\[data-theme='[\w-]+'\])?$/.test(block.selector))
function surfacesOf(cssBlocks: { selector: string; body: string }[], selectors: string[]) {
    return cssBlocks
        .filter(block => selectors.includes(block.selector))
        .flatMap(block => {
            const vars = declarations(block.body)
            return ['--background', '--card'].filter(name => name in vars).map(name => ({
                theme: block.selector,
                name,
                rgb: colorToLinear(vars[name], `${block.selector} ${name}`),
            }))
        })
}
const lightSelector = ":root[data-theme='light']"
const darkSurfaces = surfacesOf(themeBlocks, themeBlocks.map(block => block.selector).filter(selector => selector !== lightSelector))
const lightSurfaces = surfacesOf(themeBlocks, [lightSelector])

const pickBanTones = declarations(themeCss)
const reservedHues = ['--color-pickban-a', '--color-pickban-b', '--color-pickban-gold'].map(name => ({
    name,
    hue: linearToOklchHue(hexToLinear(pickBanTones[name])),
}))

const slots = Array.from({ length: ACCENT_SLOT_COUNT }, (_, slot) => slot)

describe('team accent palette', () => {
    it('defines one dark and one light value per accent slot', () => {
        for (const accents of [darkAccents, lightAccents]) {
            expect(Object.keys(accents).sort()).toEqual(slots.map(slot => `--team-accent-${slot}`).sort())
        }
    })

    it('reads the surfaces of every theme', () => {
        expect(lightSurfaces.length).toBeGreaterThan(0)
        expect(new Set(darkSurfaces.map(surface => surface.theme)).size).toBeGreaterThan(5)
        expect(reservedHues.every(tone => Number.isFinite(tone.hue))).toBe(true)
    })

    for (const [mode, accents, surfaces] of [
        ['dark', darkAccents, darkSurfaces],
        ['light', lightAccents, lightSurfaces],
    ] as const) {
        describe(`${mode} themes`, () => {
            it.each(slots)('slot %i stays inside the sRGB gamut', slot => {
                const rgb = oklchToLinear(parseOklch(accents[`--team-accent-${slot}`]))
                expect(rgb.every(channel => channel >= 0 && channel <= 1)).toBe(true)
            })

            it.each(slots)('slot %i passes text contrast on every surface', slot => {
                const rgb = oklchToLinear(parseOklch(accents[`--team-accent-${slot}`]))
                for (const surface of surfaces) {
                    expect(contrast(rgb, surface.rgb), `${surface.theme} ${surface.name}`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
                }
            })

            it.each(slots)('slot %i keeps clear of the Red, Blue and decider gold tones', slot => {
                const accent = parseOklch(accents[`--team-accent-${slot}`])
                if (accent.c < CHROMATIC) return
                for (const tone of reservedHues) {
                    expect(hueDistance(accent.h, tone.hue), tone.name).toBeGreaterThanOrEqual(MIN_HUE_DISTANCE)
                }
            })
        })
    }

    it('gives every slot its own hue', () => {
        for (const accents of [darkAccents, lightAccents]) {
            const hues = slots.map(slot => parseOklch(accents[`--team-accent-${slot}`])).filter(accent => accent.c >= CHROMATIC).map(accent => accent.h)
            for (const [index, hue] of hues.entries()) {
                for (const other of hues.slice(index + 1)) expect(hueDistance(hue, other)).toBeGreaterThanOrEqual(15)
            }
        }
    })
})

describe('theme surface parsing', () => {
    const surfaceOf = (value: string) =>
        surfacesOf(blocks(`:root[data-theme='probe'] { --background: ${value}; }`), [":root[data-theme='probe']"])

    it.each([
        'hsl(0 0% 100%)',
        'hsl(0, 0%, 100%)',
        'hsl(0deg 0% 100% / 1)',
        'hsla(0, 0%, 100%, 100%)',
        '#fff',
        '#FFFFFF',
        'rgb(255 255 255)',
        'rgb(255, 255, 255)',
        'rgba(255, 255, 255, 1)',
        'oklch(1 0 0)',
        'oklch(100% 0 0)',
    ])('reads %s as white', value => {
        expect(luminance(surfaceOf(value)[0].rgb)).toBeCloseTo(1, 4)
    })

    it.each(['#808080', 'rgb(128 128 128)', 'hsl(0 0% 50.196%)'])('reads %s as mid grey', value => {
        expect(luminance(surfaceOf(value)[0].rgb)).toBeCloseTo(0.21586, 4)
    })

    it.each(['lab(50% 0 0)', 'var(--color-neutral-950)', 'color-mix(in srgb, red, blue)', '#12'])(
        'fails on %s instead of skipping the theme',
        value => {
            expect(() => surfaceOf(value)).toThrow(/probe.*--background/)
        }
    )

    it.each(['hsl(0 0% 100% / 0.9)', 'rgba(255, 255, 255, 0.5)', 'oklch(1 0 0 / 50%)'])(
        'fails on the translucent %s instead of scoring it as opaque',
        value => {
            expect(() => surfaceOf(value)).toThrow(/probe.*--background.*translucent/)
        }
    )

    it('has a surface block for every registered theme', () => {
        const selectors = themeBlocks.map(block => block.selector)
        for (const { id } of THEMES) {
            expect(selectors).toContain(id === DEFAULT_THEME_ID ? ':root' : `:root[data-theme='${id}']`)
        }
    })
})

describe('teamAccentColor', () => {
    it('points each slot at its token', () => {
        expect(teamAccentColor(0)).toBe('var(--team-accent-0)')
        expect(teamAccentColor(11)).toBe('var(--team-accent-11)')
    })

    it('wraps slots outside the palette', () => {
        expect(teamAccentColor(12)).toBe('var(--team-accent-0)')
        expect(teamAccentColor(-1)).toBe('var(--team-accent-11)')
    })

    it('exposes the slot as the --team-accent custom property', () => {
        expect(teamAccentStyle(3)).toEqual({ '--team-accent': 'var(--team-accent-3)' })
    })
})
