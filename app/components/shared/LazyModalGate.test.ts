import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const appDir = resolve(__dirname, '../..')

const ACTION_MODALS: Record<string, string> = {
    'components/modals/CapTimeDistributionModal.tsx': 'CapTimeDistributionModal',
    'components/modals/ChangeTitleModal.tsx': 'ChangeTitleModal',
    'components/modals/HistoryModal.tsx': 'HistoryModal',
    'components/modals/MapScreenshotModal.tsx': 'MapScreenshotModal',
    'components/modals/MapScreenshotViewer.tsx': 'MapScreenshotViewer',
    'components/modals/ReplayPickerModal.tsx': 'ReplayPickerModal',
    'components/modals/ReviewModal.tsx': 'ReviewModal',
    'components/modals/WorldRecordProgressionModal.tsx': 'WorldRecordProgressionModal',
    'components/desktopPromo/DesktopPromoModal.tsx': 'DesktopPromoModal',
    'components/layout/SignOutConfirm.tsx': 'SignOutConfirm',
    'components/shared/ConfirmModal.tsx': 'ConfirmModal',
    'components/shared/DemoDownloadStatusModal.tsx': 'DemoDownloadStatusModal',
    'components/shared/ReplayVideoModal.tsx': 'ReplayVideoModal',
    'components/pages/events/manage/MatchEditorModal.tsx': 'MatchEditorModal',
    'components/pages/runCompare/keyboard/ShortcutSheetModal.tsx': 'ShortcutSheetModal',
}

const DESKTOP_ONLY_IMPORTERS = new Set(['components/pages/GameInstallationSettings.tsx'])

function isModalModule(path: string): boolean {
    return path.endsWith('Modal.tsx')
}

function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) return sourceFiles(path)
        return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
    })
}

function appPathOf(importer: string, source: string): string | null {
    const base = source.startsWith('@/app/')
        ? join(appDir, source.slice('@/app/'.length))
        : source.startsWith('.') ? resolve(dirname(importer), source) : null
    if (!base) return null
    return relative(appDir, base).replaceAll('\\', '/') + '.tsx'
}

function valueSpecifiers(clause: string): string[] {
    return clause
        .replace(/[{}]/g, '')
        .split(',')
        .map(specifier => specifier.trim())
        .filter(specifier => specifier && !specifier.startsWith('type '))
        .map(specifier => specifier.split(/\s+as\s+/)[0])
}

const sources = sourceFiles(appDir).map(file => ({ file, text: readFileSync(file, 'utf8') }))

describe('modals opened by a user action', () => {
    it('each listed modal module still exports its component', () => {
        for (const [module, component] of Object.entries(ACTION_MODALS)) {
            const source = readFileSync(join(appDir, module), 'utf8')
            expect(source, module).toMatch(new RegExp(`export (function|const) ${component}\\b`))
        }
    })

    it('are never imported statically by a page, card or the shell, so they stay out of those chunks', () => {
        const offenders: string[] = []
        for (const { file, text } of sources) {
            const importer = relative(appDir, file).replaceAll('\\', '/')
            if (isModalModule(importer) || DESKTOP_ONLY_IMPORTERS.has(importer)) continue
            for (const match of text.matchAll(/^import\s+(type\s+)?([\s\S]*?)\s+from\s+'([^']+)'/gm)) {
                if (match[1]) continue
                const module = appPathOf(file, match[3])
                const component = module ? ACTION_MODALS[module] : undefined
                if (component && valueSpecifiers(match[2]).includes(component)) {
                    offenders.push(`${importer} imports ${component}`)
                }
            }
        }
        expect(offenders).toEqual([])
    })
})
