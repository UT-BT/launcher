import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { STREAM_PANELS, initialStreamPanel } from './streamPanels'
import { MATCH_SECTIONS } from './panels/match/matchSections'

const APP_ROOT = resolve(__dirname, '../../../..')
const REPO_ROOT = resolve(APP_ROOT, '..')

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) return sourceFiles(path)
        return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
    })
}

function staticImportTargets(file: string): string[] {
    return [...readFileSync(file, 'utf8').matchAll(/^import\s+(?!type\s)[\s\S]*?from\s+'([^']+)'/gm)]
        .map(match => match[1])
        .filter(source => source.startsWith('.') || source.startsWith('@/'))
        .map(source => (source.startsWith('@/') ? resolve(REPO_ROOT, source.slice(2)) : resolve(dirname(file), source)))
}

const LAZY_MODULES = [
    'panels/MatchPanel', 'panels/CamsPanel', 'panels/ScorePanel', 'panels/StudioPanel',
    'panels/SetupPanel', 'panels/GuidePanel', 'panels/CamTool',
    'panels/match/CurrentMatchSection', 'panels/match/LineupSection', 'panels/channel/StreamingOnSection',
    'panels/match/CountdownSection', 'StreamTab',
]

describe('Stream tab panels', () => {
    it('lists every panel in the order the tab shows them', () => {
        expect(STREAM_PANELS.map(panel => [panel.id, panel.label])).toEqual([
            ['match', 'Match'],
            ['cams', 'Cams'],
            ['score', 'Score'],
            ['studio', 'Studio'],
            ['setup', 'Setup'],
            ['guide', 'Guide'],
        ])
    })

    it('puts the match-night panels first and the one-time setup after them', () => {
        expect(STREAM_PANELS.map(panel => [panel.id, panel.group])).toEqual([
            ['match', 'live'],
            ['cams', 'live'],
            ['score', 'live'],
            ['studio', 'live'],
            ['setup', 'setup'],
            ['guide', 'setup'],
        ])
    })

    it('lists the Match panel sections in the order the panel shows them', () => {
        expect(MATCH_SECTIONS.map(section => [section.id, section.label])).toEqual([
            ['current', 'Current match'],
            ['lineup', 'Lineup'],
            ['streaming-on', 'Streaming on'],
            ['countdown', 'Countdown'],
        ])
    })

    it('loads each panel and section as a component from its own module', async () => {
        const entries = [...STREAM_PANELS, ...MATCH_SECTIONS]
        const components = await Promise.all(entries.map(async entry => (await entry.load()).default))

        for (const component of components) expect(typeof component).toBe('function')
        expect(new Set(components).size).toBe(entries.length)
    })

    it('never pulls a panel, section or the tab itself in through a static import', () => {
        const lazyTargets = new Set(LAZY_MODULES.map(module => resolve(__dirname, module)))
        const offenders = sourceFiles(APP_ROOT).flatMap(file => staticImportTargets(file)
            .filter(target => lazyTargets.has(target))
            .map(target => `${file} -> ${target}`))

        expect(offenders).toEqual([])
    })
})

describe('the panel the Stream tab opens on', () => {
    it('opens Setup while the streamer has never downloaded a kit', () => {
        expect(initialStreamPanel(null, 'none')).toBe('setup')
    })

    it('opens Match once the streamer has a kit', () => {
        expect(initialStreamPanel(null, 'downloaded')).toBe('match')
    })

    it('opens Match when the kit state could not be read', () => {
        expect(initialStreamPanel(null, 'unknown')).toBe('match')
    })

    it('waits for the kit state instead of guessing', () => {
        expect(initialStreamPanel(null, 'loading')).toBeNull()
    })

    it('keeps a remembered choice over the kit rule, even while the kit state loads', () => {
        expect(initialStreamPanel('guide', 'none')).toBe('guide')
        expect(initialStreamPanel('score', 'downloaded')).toBe('score')
        expect(initialStreamPanel('cams', 'loading')).toBe('cams')
    })

    it('falls back to the kit rule for panels that no longer exist', () => {
        for (const old of ['show', 'channel', 'kit', 'scenes']) {
            expect(initialStreamPanel(old, 'none')).toBe('setup')
            expect(initialStreamPanel(old, 'downloaded')).toBe('match')
            expect(initialStreamPanel(old, 'loading')).toBeNull()
        }
    })
})
