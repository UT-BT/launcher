export type Engine = 'webkit' | 'chromium'

export const ENGINES: readonly Engine[] = ['webkit', 'chromium']

export type MatrixScope = 'pr' | 'full'

export type ViewportGroup = 'portrait' | 'landscape' | 'foldable-tablet'

export interface MobileViewport {
    id: string
    width: number
    height: number
    group: ViewportGroup
}

export interface CrawlViewport extends MobileViewport {
    engines: Engine[]
}

function viewport(width: number, height: number, group: ViewportGroup): MobileViewport {
    return { id: `${width}x${height}`, width, height, group }
}

export const MOBILE_VIEWPORTS: readonly MobileViewport[] = [
    viewport(360, 780, 'portrait'),
    viewport(390, 844, 'portrait'),
    viewport(393, 852, 'portrait'),
    viewport(402, 874, 'portrait'),
    viewport(412, 915, 'portrait'),
    viewport(430, 932, 'portrait'),
    viewport(440, 956, 'portrait'),
    viewport(780, 360, 'landscape'),
    viewport(844, 390, 'landscape'),
    viewport(915, 412, 'landscape'),
    viewport(932, 430, 'landscape'),
    viewport(956, 440, 'landscape'),
    viewport(673, 841, 'foldable-tablet'),
    viewport(744, 1133, 'foldable-tablet'),
    viewport(820, 1180, 'foldable-tablet'),
    viewport(1024, 1366, 'foldable-tablet'),
    viewport(1180, 820, 'foldable-tablet'),
]

export const PR_SUBSET: Readonly<Record<Engine, readonly string[]>> = {
    webkit: ['390x844', '844x390'],
    chromium: ['360x780', '915x412'],
}

export function viewportOrder(id: string): number {
    const index = MOBILE_VIEWPORTS.findIndex(entry => entry.id === id)
    return index === -1 ? MOBILE_VIEWPORTS.length : index
}

function byId(id: string): MobileViewport {
    const found = MOBILE_VIEWPORTS.find(entry => entry.id === id)
    if (!found) throw new Error(`viewport ${id} is not in the mobile matrix`)
    return found
}

export function crawlViewports(scope: MatrixScope): CrawlViewport[] {
    if (scope === 'full') return MOBILE_VIEWPORTS.map(entry => ({ ...entry, engines: [...ENGINES] }))
    return ENGINES.flatMap(engine => PR_SUBSET[engine].map(id => ({ ...byId(id), engines: [engine] })))
}

export function matrixScope(value: string | undefined): MatrixScope {
    if (!value || value === 'pr') return 'pr'
    if (value === 'full') return 'full'
    throw new Error(`MOBILE_MATRIX must be "pr" or "full", got "${value}"`)
}
