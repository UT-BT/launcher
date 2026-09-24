import type {
    PickBanActor,
    PickBanBlockingReason,
    PickBanExclusion,
    PickBanMember,
    PickBanPacing,
    PickBanPhase,
    PickBanPlanStep,
    PickBanReady,
    PickBanSegment,
    PickBanSessionStatus,
    PickBanSide,
    PickBanState,
    PickBanStepAction,
    PickBanUserRef,
    PickBanWarning,
} from '@/app/utils/api'
import { parseApiInstant } from '@/app/utils/timezone'

export type PickBanViewPhase = PickBanPhase | 'none'

export type PickBanStagePhase = Exclude<PickBanViewPhase, 'paused'>

export type PickBanCardState = 'available' | 'banned' | 'picked' | 'decider' | 'excluded'

export type PickBanStepStatus = 'upcoming' | 'current' | 'locked_in' | 'revealed'

export interface PickBanCountdown {
    endsAt: number | null
    remainingMs: number
    totalMs: number
    frozen: boolean
}

export interface PickBanTimelineEntry {
    key: number
    index: number
    number: number
    segment: PickBanSegment
    action: PickBanStepAction
    actor: PickBanActor | null
    side: PickBanSide | null
    actorLabel: string
    actionLabel: string
    mapNumber: number | null
    status: PickBanStepStatus
    map: string | null
    screenshotVersion: string | null
    actedBy: PickBanUserRef | null
    actedByAdmin: boolean
    revealAt: number | null
}

export interface PickBanSkippedBan {
    key: string
    actor: PickBanActor
    beforeIndex: number
}

export interface PickBanCardView {
    key: string
    map: string
    tags: string[]
    screenshotVersion: string | null
    state: PickBanCardState
    side: PickBanSide | null
    ab: PickBanActor | null
    segment: PickBanSegment | null
    stepNumber: number | null
    mapNumber: number | null
    exclusion: PickBanExclusion | null
    exclusionReason: string | null
    previewed: boolean
    lockedIn: boolean
    selected: boolean
    selectable: boolean
}

export interface PickBanTurn {
    stepIndex: number
    stepNumber: number
    side: PickBanSide | null
    ab: PickBanActor | null
    actorLabel: string
    action: PickBanStepAction
    segment: PickBanSegment
    mapNumber: number | null
    actionLabel: string
    viewerActs: boolean
    lockedIn: boolean
}

export interface PickBanSummaryEntry {
    key: number
    mapNumber: number
    stepIndex: number
    map: string | null
    screenshotVersion: string | null
    side: PickBanSide | null
    ab: PickBanActor | null
    actorLabel: string
    decider: boolean
}

export type PickBanBanner =
    | { kind: 'voided'; key: string; reason: string | null }
    | { kind: 'cancelled'; key: string; reason: string | null }
    | { kind: 'paused'; key: string; since: number | null }
    | { kind: 'skipped_bans'; key: string; count: number }
    | { kind: 'warning'; key: string; message: string }

export interface PickBanTeamPanel {
    key: PickBanSide
    side: PickBanSide
    ab: PickBanActor | null
    name: string
    stageSeed: number | null
    preCupSeed: number | null
    members: PickBanMember[]
    onlineCount: number
    ready: PickBanReady | null
    onTurn: boolean
    viewerTeam: boolean
}

export interface PickBanMatchHeading {
    title: string
    stageName: string
    roundLabel: string | null
    bestOf: number
}

export interface PickBanManagerControls {
    open: boolean
    start: boolean
    startBlockedBy: PickBanBlockingReason | null
    chooseA: boolean
    swap: boolean
    overrideSequence: boolean
    pause: boolean
    resume: boolean
    undo: boolean
    reopen: boolean
    restart: boolean
    cancel: boolean
    handOver: boolean
    editFinal: boolean
    actForSide: PickBanSide | null
}

export interface PickBanAffordances {
    actingSide: PickBanSide | null
    actingAb: PickBanActor | null
    canReady: boolean
    isReady: boolean
    canLock: boolean
    manager: PickBanManagerControls | null
}

export interface PickBanView {
    match: PickBanMatchHeading
    status: PickBanSessionStatus
    phase: PickBanViewPhase
    stagePhase: PickBanStagePhase
    countdown: PickBanCountdown | null
    turn: PickBanTurn | null
    spotlight: PickBanTimelineEntry | null
    cards: PickBanCardView[]
    timeline: PickBanTimelineEntry[]
    skippedBans: PickBanSkippedBan[]
    summary: PickBanSummaryEntry[]
    teams: { left: PickBanTeamPanel | null; right: PickBanTeamPanel | null }
    banners: PickBanBanner[]
    affordances: PickBanAffordances
    edited: boolean
    nextBoundaryAt: number | null
    scene: PickBanScene
}

export type PickBanSceneKind = 'none' | 'lobby' | 'intro' | 'turn' | 'reveal' | 'complete' | 'cancelled' | 'voided'

export interface PickBanScene {
    key: string
    kind: PickBanSceneKind
    position: number
    elapsedMs: number | null
    entranceMs: number
}

export type PickBanSceneDirection = -1 | 0 | 1

export interface PickBanClock {
    clockOffsetMs: number
    now: number
}


type LivePhase = 'lobby' | 'intro' | 'awaiting' | 'spotlight' | 'complete'

interface LiveTiming {
    phase: LivePhase
    startsAt: number | null
    endsAt: number | null
}

interface Moment {
    state: PickBanState
    clock: number
    frozenAt: number | null
    toLocal: (serverInstant: number) => number
    steps: PickBanPlanStep[]
    revealedSteps: PickBanPlanStep[]
    lastRevealed: PickBanPlanStep | null
    currentStep: PickBanPlanStep | null
    pendingStep: PickBanPlanStep | null
}

const LIVE_STATUSES: PickBanSessionStatus[] = ['running', 'paused', 'complete']

const IDLE_TIMING: LiveTiming = { phase: 'lobby', startsAt: null, endsAt: null }

const ENTRANCE_SHARE = 0.15

const PLAIN_ENTRANCE_MS = 350

export const INTRO_ENTRANCE_MAX_MS = 900

export const REVEAL_ENTRANCE_MAX_MS: { [segment in PickBanSegment]: number } = {
    lettered: 1_200,
    ban_down: 600,
    decider: 1_500,
}

const CARD_STATE_OF_ACTION: { [action in PickBanStepAction]: PickBanCardState } = {
    ban: 'banned',
    pick: 'picked',
    decider: 'decider',
}

function otherSide(side: PickBanSide): PickBanSide {
    return side === 'team_a' ? 'team_b' : 'team_a'
}

function spotlightLengthMs(pacing: PickBanPacing, segment: PickBanSegment): number {
    if (segment === 'ban_down') return pacing.ban_down_spotlight * 1000
    if (segment === 'decider') return pacing.decider_spotlight * 1000
    return pacing.spotlight * 1000
}

function isExecuted(step: PickBanPlanStep): boolean {
    return step.map !== null
}

function revealAtOf(step: PickBanPlanStep): number | null {
    return parseApiInstant(step.reveal_at)
}

function isRevealedAt(step: PickBanPlanStep, clock: number): boolean {
    return isExecuted(step) && (revealAtOf(step) ?? -Infinity) <= clock
}

function introStartsAt(state: PickBanState): number | null {
    const introEnd = parseApiInstant(state.intro_ends_at)
    return introEnd === null ? null : introEnd - state.pacing.intro * 1000
}

function teamNameOf(state: PickBanState, side: PickBanSide | null): string | null {
    return side ? state.teams[side]?.name ?? null : null
}

function screenshotVersionOf(state: PickBanState, map: string | null): string | null {
    return map === null ? null : state.pool.find((card) => card.map === map)?.screenshot_version ?? null
}

function viewerActs(state: PickBanState, step: PickBanPlanStep): boolean {
    return step.side !== null && step.side === state.capabilities.acting_side
}

function warningMessage(warning: PickBanWarning): string {
    if (typeof warning === 'string') return warning
    return warning.message || warning.code || 'Warning'
}

function exclusionReasonOf(state: PickBanState, exclusion: PickBanExclusion | null): string | null {
    if (!exclusion) return null
    const triggers = exclusion.triggered_by
        .map((trigger) => `${teamNameOf(state, trigger.side) ?? trigger.team_id} has pre-cup seed ${trigger.pre_cup_seed}`)
        .join(' and ')
    if (!triggers) return `${exclusion.tag} maps are excluded for this match.`
    return `${exclusion.tag} maps are excluded because ${triggers} (${exclusion.min_pre_cup_seed} or higher).`
}

function actorLabelOf(state: PickBanState, step: PickBanPlanStep): string {
    if (step.actor === null) return 'Decider'
    return teamNameOf(state, step.side) ?? `Team ${step.actor}`
}

function actionLabelOf(state: PickBanState, step: PickBanPlanStep): string {
    if (step.action === 'decider') return 'Decider'
    return `${actorLabelOf(state, step)} ${step.action === 'ban' ? 'bans' : 'picks'}`
}

function stagePhaseOf(status: PickBanSessionStatus, livePhase: LivePhase): PickBanStagePhase {
    if (status === 'none' || status === 'cancelled' || status === 'voided') return status
    return livePhase
}

export interface PickBanRevealedSteps {
    clock: number
    frozenAt: number | null
    steps: PickBanPlanStep[]
    revealed: PickBanPlanStep[]
}

export function revealedStepsAt(state: PickBanState, { clockOffsetMs, now }: PickBanClock): PickBanRevealedSteps {
    const frozenAt = state.status === 'paused' ? parseApiInstant(state.paused_at) : null
    const serverNow = now + clockOffsetMs
    const clock = frozenAt === null ? serverNow : Math.min(serverNow, frozenAt)
    const steps = [...state.plan].sort((a, b) => a.index - b.index)
    const revealed = steps.filter((step) => isRevealedAt(step, clock))
    return { clock, frozenAt, steps, revealed }
}

function momentOf(state: PickBanState, clockInput: PickBanClock): Moment {
    const { clock, frozenAt, steps, revealed: revealedSteps } = revealedStepsAt(state, clockInput)
    const currentStep = steps.find((step) => !isRevealedAt(step, clock)) ?? null
    return {
        state,
        clock,
        frozenAt,
        toLocal: (serverInstant) => serverInstant - clockInput.clockOffsetMs,
        steps,
        revealedSteps,
        lastRevealed: revealedSteps[revealedSteps.length - 1] ?? null,
        currentStep,
        pendingStep: currentStep && isExecuted(currentStep) ? currentStep : null,
    }
}

function spotlightEndOf(moment: Moment, step: PickBanPlanStep): number {
    const own = (revealAtOf(step) ?? -Infinity) + spotlightLengthMs(moment.state.pacing, step.segment)
    const following = moment.steps.find((candidate) => candidate.index > step.index && isExecuted(candidate))
    if (!following) return parseApiInstant(moment.state.spotlight_ends_at) ?? own
    if (following.actor === null) return Math.max(own, revealAtOf(following) ?? own)
    return own
}

function liveTiming(moment: Moment): LiveTiming {
    const { state, clock, lastRevealed, currentStep } = moment
    if (!LIVE_STATUSES.includes(state.status)) return IDLE_TIMING
    const introStart = introStartsAt(state)
    if (introStart !== null && clock < introStart) return IDLE_TIMING
    const introEnd = parseApiInstant(state.intro_ends_at)
    if (introEnd !== null && clock < introEnd) return { phase: 'intro', startsAt: introStart, endsAt: introEnd }
    const settledPhase = currentStep ? 'awaiting' : 'complete'
    if (lastRevealed) {
        const spotlightEnd = spotlightEndOf(moment, lastRevealed)
        if (clock < spotlightEnd) return { phase: 'spotlight', startsAt: revealAtOf(lastRevealed), endsAt: spotlightEnd }
        return { phase: settledPhase, startsAt: spotlightEnd, endsAt: null }
    }
    return { phase: settledPhase, startsAt: introEnd, endsAt: null }
}

function countdownOf(moment: Moment, timing: LiveTiming): PickBanCountdown | null {
    if (timing.endsAt === null) return null
    const frozen = moment.state.status === 'paused'
    return {
        endsAt: frozen ? null : moment.toLocal(timing.endsAt),
        remainingMs: Math.max(0, timing.endsAt - moment.clock),
        totalMs: timing.startsAt === null ? 0 : timing.endsAt - timing.startsAt,
        frozen,
    }
}

function managerControlsOf(moment: Moment, awaitedStep: PickBanPlanStep | null): PickBanManagerControls | null {
    const { state, steps } = moment
    if (!state.capabilities.can_manage) return null
    const status = state.status
    const live = LIVE_STATUSES.includes(status)
    return {
        open: status === 'none' || status === 'cancelled' || status === 'voided',
        start: status === 'lobby',
        startBlockedBy: status === 'lobby' ? state.blocking_reason : null,
        chooseA: status === 'lobby',
        swap: state.a_side !== null && (status === 'lobby' || (status === 'running' && !steps.some(isExecuted))),
        overrideSequence: status === 'lobby',
        pause: status === 'running',
        resume: status === 'paused',
        undo: (status === 'running' || status === 'paused') && steps.some((step) => isExecuted(step) && step.actor !== null),
        reopen: status === 'complete',
        restart: live,
        cancel: status === 'lobby' || live,
        handOver: status === 'lobby' || status === 'running' || status === 'paused',
        editFinal: status === 'complete',
        actForSide: status === 'running' && awaitedStep ? awaitedStep.side : null,
    }
}

function affordancesOf(moment: Moment, awaitedStep: PickBanPlanStep | null): PickBanAffordances {
    const { state } = moment
    const actingSide = state.capabilities.acting_side
    return {
        actingSide,
        actingAb: actingSide ? state.teams[actingSide]?.ab ?? null : null,
        canReady: state.status === 'lobby' && state.capabilities.can_ready,
        isReady: actingSide !== null && state.ready[actingSide] !== null,
        canLock: state.status === 'running'
            && awaitedStep !== null
            && viewerActs(state, awaitedStep)
            && (state.phase !== 'awaiting' || state.capabilities.can_lock_now),
        manager: managerControlsOf(moment, awaitedStep),
    }
}

function timelineOf(moment: Moment, inProgress: boolean): PickBanTimelineEntry[] {
    const { state, clock, currentStep, pendingStep } = moment
    return moment.steps.map((step) => {
        const revealed = isRevealedAt(step, clock)
        const revealAt = revealAtOf(step)
        let status: PickBanStepStatus = 'upcoming'
        if (revealed) status = 'revealed'
        else if (inProgress && step === currentStep) status = step === pendingStep && viewerActs(state, step) ? 'locked_in' : 'current'
        return {
            key: step.index,
            index: step.index,
            number: step.index + 1,
            segment: step.segment,
            action: step.action,
            actor: step.actor,
            side: step.side,
            actorLabel: actorLabelOf(state, step),
            actionLabel: actionLabelOf(state, step),
            mapNumber: step.map_number,
            status,
            map: revealed ? step.map : null,
            screenshotVersion: revealed ? screenshotVersionOf(state, step.map) : null,
            actedBy: revealed ? step.acted_by : null,
            actedByAdmin: revealed && step.acted_by_admin,
            revealAt: revealAt === null ? null : moment.toLocal(revealAt),
        }
    })
}

function skippedBansOf(state: PickBanState): PickBanSkippedBan[] {
    return state.skipped_bans.map((skipped, order) => ({
        key: `skipped-${order}`,
        actor: skipped.actor,
        beforeIndex: skipped.before_index,
    }))
}

function cardsOf(moment: Moment, awaitedStep: PickBanPlanStep | null, canChoose: boolean): PickBanCardView[] {
    const { state, pendingStep } = moment
    const revealedByMap = new Map(moment.revealedSteps.map((step) => [step.map, step]))
    const preview = state.selection_preview
    return state.pool.map((poolCard) => {
        const step = revealedByMap.get(poolCard.map)
        let cardState: PickBanCardState = 'available'
        if (step) cardState = CARD_STATE_OF_ACTION[step.action]
        else if (poolCard.excluded) cardState = 'excluded'
        const available = cardState === 'available'
        return {
            key: poolCard.map,
            map: poolCard.map,
            tags: poolCard.tags,
            screenshotVersion: poolCard.screenshot_version,
            state: cardState,
            side: step?.side ?? null,
            ab: step?.actor ?? null,
            segment: step?.segment ?? null,
            stepNumber: step ? step.index + 1 : null,
            mapNumber: step?.map_number ?? null,
            exclusion: poolCard.exclusion,
            exclusionReason: exclusionReasonOf(state, poolCard.exclusion),
            previewed: available
                && awaitedStep !== null
                && preview !== null
                && preview.map === poolCard.map
                && preview.side === awaitedStep.side,
            lockedIn: pendingStep !== null && viewerActs(state, pendingStep) && pendingStep.map === poolCard.map,
            selected: false,
            selectable: available && canChoose,
        }
    })
}

function summaryOf(moment: Moment): PickBanSummaryEntry[] {
    const { state, clock } = moment
    return moment.steps
        .filter((step): step is PickBanPlanStep & { map_number: number } => step.map_number !== null)
        .sort((a, b) => a.map_number - b.map_number)
        .map((step) => {
            const map = isRevealedAt(step, clock) ? step.map : null
            return {
                key: step.map_number,
                mapNumber: step.map_number,
                stepIndex: step.index,
                map,
                screenshotVersion: screenshotVersionOf(state, map),
                side: step.side,
                ab: step.actor,
                actorLabel: actorLabelOf(state, step),
                decider: step.action === 'decider',
            }
        })
}

function turnOf(moment: Moment, inProgress: boolean): PickBanTurn | null {
    const { state, currentStep, pendingStep } = moment
    if (!inProgress || !currentStep) return null
    const acts = viewerActs(state, currentStep)
    return {
        stepIndex: currentStep.index,
        stepNumber: currentStep.index + 1,
        side: currentStep.side,
        ab: currentStep.actor,
        actorLabel: actorLabelOf(state, currentStep),
        action: currentStep.action,
        segment: currentStep.segment,
        mapNumber: currentStep.map_number,
        actionLabel: actionLabelOf(state, currentStep),
        viewerActs: acts,
        lockedIn: acts && currentStep === pendingStep,
    }
}

function panelOf(moment: Moment, side: PickBanSide, awaitedStep: PickBanPlanStep | null): PickBanTeamPanel | null {
    const { state } = moment
    const team = state.teams[side]
    if (!team) return null
    return {
        key: side,
        side,
        ab: team.ab,
        name: team.name,
        stageSeed: team.stage_seed,
        preCupSeed: team.pre_cup_seed,
        members: team.members,
        onlineCount: team.members.filter((m) => m.online).length,
        ready: state.ready[side],
        onTurn: awaitedStep !== null && awaitedStep.side === side,
        viewerTeam: state.viewer.side === side,
    }
}

function matchHeadingOf(state: PickBanState, leftSide: PickBanSide): PickBanMatchHeading {
    const nameOf = (side: PickBanSide) => teamNameOf(state, side) ?? 'TBD'
    return {
        title: `${nameOf(leftSide)} vs ${nameOf(otherSide(leftSide))}`,
        stageName: state.match.stage_name,
        roundLabel: state.match.round_label,
        bestOf: state.match.best_of,
    }
}

function bannersOf(moment: Moment): PickBanBanner[] {
    const { state, frozenAt } = moment
    const banners: PickBanBanner[] = []
    if (state.status === 'voided') banners.push({ kind: 'voided', key: 'voided', reason: state.end_reason })
    if (state.status === 'cancelled') banners.push({ kind: 'cancelled', key: 'cancelled', reason: state.end_reason })
    if (state.status === 'paused') banners.push({ kind: 'paused', key: 'paused', since: frozenAt === null ? null : moment.toLocal(frozenAt) })
    if (state.dropped_bans > 0) banners.push({ kind: 'skipped_bans', key: 'skipped_bans', count: state.dropped_bans })
    state.warnings.forEach((warning, index) => {
        banners.push({ kind: 'warning', key: `warning-${index}`, message: warningMessage(warning) })
    })
    return banners
}

function nextBoundaryOf(moment: Moment, timing: LiveTiming): number | null {
    const { state, clock } = moment
    if (state.status !== 'running' && state.status !== 'complete') return null
    const upcoming = [
        introStartsAt(state),
        parseApiInstant(state.intro_ends_at),
        timing.endsAt,
        ...moment.steps.filter(isExecuted).map(revealAtOf),
    ].filter((instant): instant is number => instant !== null && instant > clock)
    return upcoming.length > 0 ? moment.toLocal(Math.min(...upcoming)) : null
}

export function buildPickBanView(state: PickBanState, clock: PickBanClock): PickBanView {
    const moment = momentOf(state, clock)
    const timing = liveTiming(moment)
    const inProgress = timing.phase === 'intro' || timing.phase === 'awaiting' || timing.phase === 'spotlight'
    const awaitedStep = timing.phase === 'awaiting' && !moment.pendingStep ? moment.currentStep : null
    const affordances = affordancesOf(moment, awaitedStep)
    const canChoose = affordances.canLock || (affordances.manager?.actForSide ?? null) !== null
    const timeline = timelineOf(moment, inProgress)
    const spotlightIndex = timing.phase === 'spotlight' ? moment.lastRevealed?.index : undefined
    const leftSide = state.a_side ?? 'team_a'
    const stagePhase = stagePhaseOf(state.status, timing.phase)

    return {
        match: matchHeadingOf(state, leftSide),
        status: state.status,
        phase: state.status === 'paused' ? 'paused' : stagePhase,
        stagePhase,
        countdown: countdownOf(moment, timing),
        turn: turnOf(moment, inProgress),
        spotlight: timeline.find((entry) => entry.index === spotlightIndex) ?? null,
        cards: cardsOf(moment, awaitedStep, canChoose),
        timeline,
        skippedBans: skippedBansOf(state),
        summary: summaryOf(moment),
        teams: { left: panelOf(moment, leftSide, awaitedStep), right: panelOf(moment, otherSide(leftSide), awaitedStep) },
        banners: bannersOf(moment),
        affordances,
        edited: state.edited,
        nextBoundaryAt: nextBoundaryOf(moment, timing),
        scene: sceneOf(moment, stagePhase, timing),
    }
}

type SceneIdentity = Pick<PickBanScene, 'key' | 'kind' | 'position'>

function sceneIdentityOf(moment: Moment, stagePhase: PickBanStagePhase): SceneIdentity {
    const { currentStep, lastRevealed, steps } = moment
    const end = 2 + 2 * steps.length
    if (stagePhase === 'awaiting' && currentStep) {
        return { key: `turn-${currentStep.index}`, kind: 'turn', position: 2 + 2 * currentStep.index }
    }
    if (stagePhase === 'spotlight' && lastRevealed) {
        return { key: `reveal-${lastRevealed.index}`, kind: 'reveal', position: 3 + 2 * lastRevealed.index }
    }
    switch (stagePhase) {
        case 'none':
            return { key: 'none', kind: 'none', position: -1 }
        case 'lobby':
            return { key: 'lobby', kind: 'lobby', position: 0 }
        case 'intro':
            return { key: 'intro', kind: 'intro', position: 1 }
        case 'cancelled':
        case 'voided':
            return { key: stagePhase, kind: stagePhase, position: end + 1 }
        default:
            return { key: 'complete', kind: 'complete', position: end }
    }
}

function entranceMsOf(moment: Moment, kind: PickBanSceneKind): number {
    const { pacing } = moment.state
    if (kind === 'intro') return Math.min(INTRO_ENTRANCE_MAX_MS, pacing.intro * 1000 * ENTRANCE_SHARE)
    if (kind !== 'reveal' || !moment.lastRevealed) return PLAIN_ENTRANCE_MS
    const { segment } = moment.lastRevealed
    return Math.min(REVEAL_ENTRANCE_MAX_MS[segment], spotlightLengthMs(pacing, segment) * ENTRANCE_SHARE)
}

function sceneOf(moment: Moment, stagePhase: PickBanStagePhase, timing: LiveTiming): PickBanScene {
    const identity = sceneIdentityOf(moment, stagePhase)
    return {
        ...identity,
        elapsedMs: timing.startsAt === null ? null : moment.clock - timing.startsAt,
        entranceMs: entranceMsOf(moment, identity.kind),
    }
}

export function sceneDirection(previous: PickBanScene | null, next: PickBanScene): PickBanSceneDirection {
    if (previous === null || previous.key === next.key) return 0
    return next.position < previous.position ? -1 : 1
}

export function playsEntrance(scene: PickBanScene, direction: PickBanSceneDirection): boolean {
    return direction < 0 || scene.elapsedMs === null || scene.elapsedMs <= scene.entranceMs
}
