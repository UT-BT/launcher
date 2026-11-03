import type { Page } from '@playwright/test'
import { dataFrom, type FixtureData } from '../fixtures/data'
import { fixtureSetNamed } from '../fixtures/index'
import { STRESS_VARIANTS, type StressVariant } from '../fixtures/stress'
import type { MatrixScope } from '../viewports'
import { achievements } from './achievements'
import { admin } from './admin'
import { capDetail } from './cap-detail'
import { capItAll } from './cap-it-all'
import { eventDetail } from './event-detail'
import { eventDetailManager } from './event-detail-manager'
import { eventTeam } from './event-team'
import { events } from './events'
import { home } from './home'
import { homeSignedIn } from './home-signed-in'
import { maps } from './maps'
import { mapsSignedIn } from './maps-signed-in'
import { mapsDetail } from './maps-detail'
import { matchPickban } from './match-pickban'
import { matchPickbanCaptain, matchPickbanManager } from './match-pickban-roles'
import { news } from './news'
import { newsDetail } from './news-detail'
import { playerDetail } from './player-detail'
import { players } from './players'
import { runCompare } from './run-compare'
import { servers } from './servers'
import { teamCapDetail } from './team-cap-detail'
import { teamDetail } from './team-detail'
import { teams } from './teams'
import { worldRecords } from './world-records'
import type { BoundStep, MobileModal, MobileRouteEntry, MobileSubView, PageStep, RuleSkip, StressPlan } from './types'

export const MOBILE_MANIFEST: readonly MobileRouteEntry[] = [
    home,
    servers,
    maps,
    mapsDetail,
    players,
    playerDetail,
    teams,
    teamDetail,
    events,
    eventDetail,
    matchPickban,
    eventTeam,
    worldRecords,
    capItAll,
    capDetail,
    teamCapDetail,
    achievements,
    news,
    newsDetail,
    runCompare,
    homeSignedIn,
    mapsSignedIn,
    admin,
    eventDetailManager,
    matchPickbanCaptain,
    matchPickbanManager,
]

export function entryId(entry: MobileRouteEntry): string {
    return entry.id ?? entry.view
}

export interface CrawlSurface {
    id: string
    label: string
    entry: MobileRouteEntry
    subView?: MobileSubView
    modal?: MobileModal
    variant?: StressVariant
    skip: RuleSkip[]
}

export function surfaceSteps(surface: CrawlSurface, data: FixtureData = surfaceData(surface)): { path: string; steps: BoundStep[] } {
    const { entry, subView, modal } = surface
    const reach: PageStep[] = subView?.open
        ? [entry.ready, subView.open, ...(subView.ready ? [subView.ready] : [])]
        : [shownStep(surface)]
    const steps = modal ? [...reach, modal.open] : reach
    return { path: subView?.path ?? entry.path, steps: steps.map(step => (page: Page) => step(page, data)) }
}

export function surfaceShown(surface: CrawlSurface, data: FixtureData = surfaceData(surface)): BoundStep {
    const ready = shownStep(surface)
    return page => ready(page, data)
}

function shownStep(surface: CrawlSurface): PageStep {
    return surface.subView?.ready ?? surface.entry.ready
}

function surfaceData(surface: CrawlSurface): FixtureData {
    const set = fixtureSetNamed(surface.entry.fixtures)
    if (!set) throw new Error(`no mobile fixture set named "${surface.entry.fixtures}"`)
    return dataFrom(set)
}

function stressedSurfaces(surface: CrawlSurface, plan: StressPlan | undefined, scope: MatrixScope): CrawlSurface[] {
    if (!plan) return []
    const variants = scope === 'full' ? STRESS_VARIANTS : [plan.pr]
    return variants.map(variant => ({
        ...surface,
        id: `${surface.id}~${variant}`,
        label: `${surface.label} (${variant})`,
        entry: { ...surface.entry, fixtures: `${surface.entry.fixtures}~${variant}` },
        variant,
    }))
}

export function crawlSurfaces(scope: MatrixScope = 'full'): CrawlSurface[] {
    return MOBILE_MANIFEST.flatMap(entry => {
        const base = entry.skip ?? []
        const root = entryId(entry)
        const page: CrawlSurface = { id: root, label: root, entry, skip: base }
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
                id: `${root}/${subView.id}`,
                label: `${root} › ${subView.label}`,
                entry,
                subView,
                skip: [...base, ...(subView.skip ?? [])],
            }
            return [surface, ...modalsOf(surface, subView.modals), ...stressedSurfaces(surface, subView.stress, scope)]
        })
        return [page, ...modalsOf(page, entry.modals), ...stressedSurfaces(page, entry.stress, scope), ...subViews]
    })
}
