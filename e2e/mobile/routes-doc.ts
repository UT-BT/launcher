import { MOBILE_MANIFEST, entryId } from './manifest/index'
import type { MobileModal, MobileRouteEntry, MobileSubView, RuleSkip, StressPlan } from './manifest/types'

export const MOBILE_ROUTES_COMMAND = 'npm run docs:mobile-routes'

interface PlacedModal {
    surface: string
    owner: string
    modal: MobileModal
}

interface PlacedSkip {
    scope: string
    skip: RuleSkip
}

function cell(text: string): string {
    return text.replace(/\s+/g, ' ').replaceAll('|', '\\|')
}

function code(text: string): string {
    return `\`${text}\``
}

function row(cells: readonly string[]): string {
    return `| ${cells.join(' | ')} |`
}

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string[] {
    return [row(headers), `|${headers.map(() => '---').join('|')}|`, ...rows.map(row)]
}

function stressOf(plan: StressPlan | undefined): string {
    return plan ? code(plan.pr) : 'none'
}

function reachOf(entry: MobileRouteEntry, subView: MobileSubView): string {
    return subView.path === undefined ? `a step on ${code(cell(entry.path))}` : `URL ${code(cell(subView.path))}`
}

function modalsOf(entry: MobileRouteEntry): PlacedModal[] {
    const root = entryId(entry)
    const place = (owner: string, modals: MobileModal[] = []) =>
        modals.map(modal => ({ surface: `${owner}/${modal.id}`, owner, modal }))
    return [
        ...place(root, entry.modals),
        ...(entry.subViews ?? []).flatMap(subView => place(`${root}/${subView.id}`, subView.modals)),
    ]
}

function skipsOf(entry: MobileRouteEntry): PlacedSkip[] {
    const root = entryId(entry)
    const scoped = (scope: string, skips: RuleSkip[] = []) => skips.map(skip => ({ scope, skip }))
    return [
        ...scoped(`every ${code(root)} surface`, entry.skip),
        ...(entry.modals ?? []).flatMap(modal => scoped(code(`${root}/${modal.id}`), modal.skip)),
        ...(entry.subViews ?? []).flatMap(subView => [
            ...scoped(`${code(`${root}/${subView.id}`)}, its modals and its stress variants`, subView.skip),
            ...(subView.modals ?? []).flatMap(modal => scoped(code(`${root}/${subView.id}/${modal.id}`), modal.skip)),
        ]),
    ]
}

function summary(manifest: readonly MobileRouteEntry[]): string[] {
    return table(
        ['Entry', 'View', 'Tier', 'Path', 'Fixture set', 'Sub-views', 'Modals'],
        manifest.map(entry => [
            code(entryId(entry)),
            code(entry.view),
            entry.tier,
            code(cell(entry.path)),
            code(entry.fixtures),
            String(entry.subViews?.length ?? 0),
            String(modalsOf(entry).length),
        ]),
    )
}

function section(entry: MobileRouteEntry): string[] {
    const root = entryId(entry)
    const subViews = entry.subViews ?? []
    const modals = modalsOf(entry)
    const skips = skipsOf(entry)
    return [
        `## ${root}`,
        '',
        `- **View:** ${code(entry.view)}`,
        `- **Tier:** ${entry.tier}`,
        `- **Path:** ${code(entry.path)}`,
        `- **Fixture set:** ${code(entry.fixtures)}`,
        `- **Stress variant (PR subset):** ${stressOf(entry.stress)}`,
        `- **Decorative columns:** ${entry.decorative.length ? entry.decorative.map(code).join(', ') : 'none'}`,
        '',
        '### Sub-views',
        '',
        ...(subViews.length
            ? table(
                ['Surface', 'Label', 'Reached by', 'Stress variant (PR subset)'],
                subViews.map(subView => [
                    code(`${root}/${subView.id}`),
                    cell(subView.label),
                    reachOf(entry, subView),
                    stressOf(subView.stress),
                ]),
            )
            : ['No sub-views.']),
        '',
        '### Modals',
        '',
        ...(modals.length
            ? table(
                ['Surface', 'Label', 'Opened from'],
                modals.map(({ surface, owner, modal }) => [code(surface), cell(modal.label), code(owner)]),
            )
            : ['No modals.']),
        '',
        '### Skipped rules',
        '',
        ...(skips.length
            ? skips.map(({ scope, skip }) => `- ${code(skip.rule)} on ${scope}: ${cell(skip.reason)}`)
            : ['No skipped rules.']),
    ]
}

export function renderMobileRoutesDoc(manifest: readonly MobileRouteEntry[]): string {
    return [
        '# Mobile routes',
        '',
        'Every entry of the mobile route manifest (`e2e/mobile/manifest/`), with the surfaces the mobile',
        'crawl opens for it ([testing.md](testing.md#mobile-route-manifest)). This file is generated:',
        `don't edit it by hand. After changing the manifest, run \`${MOBILE_ROUTES_COMMAND}\`;`,
        '`npm run docs:check` fails while this file no longer matches the manifest.',
        '',
        'A surface id keys the crawl\'s test titles, the ledger and the gallery. A sub-view is reached by',
        'its URL or by a step on the entry\'s page. A stress variant adds `~<variant>` to a surface id:',
        'the PR subset crawls the variant named here, the full matrix every variant. A skipped rule',
        'doesn\'t run on the surfaces it names.',
        '',
        ...summary(manifest),
        ...manifest.flatMap(entry => ['', ...section(entry)]),
        '',
    ].join('\n')
}

export function mobileRoutesDoc(): string {
    return renderMobileRoutesDoc(MOBILE_MANIFEST)
}
