import { capDetail } from './cap-detail'
import { home } from './home'
import { maps } from './maps'
import type { MobileModal, MobileRouteEntry, MobileSubView, PageStep, RuleSkip } from './types'

export const MOBILE_MANIFEST: readonly MobileRouteEntry[] = [home, maps, capDetail]

export interface CrawlSurface {
    id: string
    label: string
    entry: MobileRouteEntry
    subView?: MobileSubView
    modal?: MobileModal
    skip: RuleSkip[]
}

export function surfaceSteps(surface: CrawlSurface): { path: string; steps: PageStep[] } {
    const { entry, subView, modal } = surface
    const reach: PageStep[] = !subView
        ? [entry.ready]
        : subView.open
            ? [entry.ready, subView.open, ...(subView.ready ? [subView.ready] : [])]
            : [subView.ready ?? entry.ready]
    return { path: subView?.path ?? entry.path, steps: modal ? [...reach, modal.open] : reach }
}

export function crawlSurfaces(): CrawlSurface[] {
    return MOBILE_MANIFEST.flatMap(entry => {
        const base = entry.skip ?? []
        const page: CrawlSurface = { id: entry.view, label: entry.view, entry, skip: base }
        const modalsOf = (owner: CrawlSurface, modals: MobileModal[] = []): CrawlSurface[] =>
            modals.map(modal => ({
                id: `${owner.id}/${modal.id}`,
                label: `${owner.label} › ${modal.label}`,
                entry,
                subView: owner.subView,
                modal,
                skip: [...owner.skip, ...(modal.skip ?? [])],
            }))
        const subViews = (entry.subViews ?? []).flatMap(subView => {
            const surface: CrawlSurface = {
                id: `${entry.view}/${subView.id}`,
                label: `${entry.view} › ${subView.label}`,
                entry,
                subView,
                skip: [...base, ...(subView.skip ?? [])],
            }
            return [surface, ...modalsOf(surface, subView.modals)]
        })
        return [page, ...modalsOf(page, entry.modals), ...subViews]
    })
}
