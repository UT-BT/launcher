import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
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

function hslToLinear(value: string): Rgb {
    const [h, s, l] = value.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/)!.slice(1).map(Number)
    const sat = s / 100
    const light = l / 100
    const k = (n: number) => (n + h / 30) % 12
    const a = sat * Math.min(light, 1 - light)
    const channel = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
    return [channel(0), channel(8), channel(4)].map(toLinear) as Rgb
}

function hexToLinear(value: string): Rgb {
    return [1, 3, 5].map(index => toLinear(parseInt(value.slice(index, index + 2), 16) / 255)) as Rgb
}

function parseOklch(value: string): { l: number; c: number; h: number } {
    const [l, c, h] = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/)!.slice(1).map(Number)
    return { l, c, h }
}

function oklchToLinear({ l, c, h }: { l: number; c: number; h: number }): Rgb {
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
const surfacesOf = (selectors: string[]) =>
    themeBlocks
        .filter(block => selectors.includes(block.selector))
        .flatMap(block => {
            const vars = declarations(block.body)
            return ['--background', '--card'].filter(name => vars[name]?.startsWith('hsl(')).map(name => ({
                theme: block.selector,
                name,
                rgb: hslToLinear(vars[name]),
            }))
        })
const lightSelector = ":root[data-theme='light']"
const darkSurfaces = surfacesOf(themeBlocks.map(block => block.selector).filter(selector => selector !== lightSelector))
const lightSurfaces = surfacesOf([lightSelector])

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
