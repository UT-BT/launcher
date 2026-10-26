import type {
    MatchSideSource,
    PickBanActor,
    PickBanBlockingReason,
    PickBanChooserBasis,
    PickBanContractPhase,
    PickBanExclusion,
    PickBanFinalMap,
    PickBanMember,
    PickBanPacing,
    PickBanPhase,
    PickBanPlanStep,
    PickBanPresetId,
    PickBanReady,
    PickBanSegment,
    PickBanSequenceAction,
    PickBanSessionStatus,
    PickBanSide,
    PickBanSideBlock,
    PickBanSideCard,
    PickBanSidePhase,
    PickBanState,
    PickBanStepAction,
    PickBanUserRef,
    PickBanVeto,
    PickBanVetoPhase,
    PickBanVetoPoolSizes,
    PickBanWarning,
    SideColor,
    VetoChoice,
    VetoOutcome,
} from '@/app/utils/api'
import { parseApiInstant } from '@/app/utils/timezone'
import { sideColorName, sideColorOfLetter, sideColorTag, sideColorTitle, withSideColor } from '@/app/utils/sideLabels'
import { chooserLine, type ChooserReason } from './chooserReasonCopy'

export type PickBanViewSideBlock = Omit<PickBanSideBlock, 'chooser_reason'> & { chooser_reason: ChooserReason | null }

export type PickBanViewPacing = PickBanPacing & { veto_spotlight?: number }

export type PickBanViewState = Omit<PickBanState, 'phase' | 'side' | 'pacing'> & {
    phase: PickBanContractPhase | null
    side: PickBanViewSideBlock
    pacing: PickBanViewPacing
}

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
    color: SideColor | null
    actorLabel: string
    actionLabel: string
    mapNumber: number | null
    status: PickBanStepStatus
    map: string | null
    screenshotVersion: string | null
    actedBy: PickBanUserRef | null
    actedByAdmin: boolean
    automatic: boolean
    revealAt: number | null
    revealing: boolean
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
    pendingChoice: boolean
    pendingLabel: string | null
    vetoedBy: PickBanSide | null
    vetoedByName: string | null
    previewed: boolean
    lockedIn: boolean
    selected: boolean
    selectable: boolean
    revealing: boolean
}

export interface PickBanTurn {
    stepIndex: number
    stepNumber: number
    side: PickBanSide | null
    ab: PickBanActor | null
    color: SideColor | null
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
    stepIndex: number | null
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
    color: SideColor
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
    resultsPresent: boolean
    sideChooser: boolean
    setSides: boolean
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
    lockForSide: boolean
    actForSide: PickBanSide | null
    actForSideChoice: PickBanSide | null
    actForVeto: PickBanSide[]
    undoTarget: PickBanUndoTarget | null
}

export type PickBanUndoTarget = 'step' | 'side' | 'veto'

export interface PickBanSequenceSource {
    presetId: PickBanPresetId | null
    stageKey: string | null
    ownStage: boolean
}

export interface PickBanSetup {
    sequence: PickBanSequenceSource | null
}

export interface PickBanAffordances {
    actingSide: PickBanSide | null
    actingAb: PickBanActor | null
    canReady: boolean
    isReady: boolean
    canLock: boolean
    manager: PickBanManagerControls | null
}

export interface PickBanSideCardStepView {
    number: number
    action: PickBanSequenceAction
    segment: PickBanSegment
    mapNumber: number | null
    label: string
}

export interface PickBanSideCardView {
    color: SideColor
    letter: PickBanActor
    title: string
    lead: string
    steps: PickBanSideCardStepView[]
}

export interface PickBanSideReveal {
    side: PickBanSide
    teamName: string
    color: SideColor
    text: string
}

export interface PickBanSideView {
    phase: PickBanSidePhase | null
    red: PickBanSide
    confirmed: boolean
    tbc: boolean
    source: MatchSideSource | null
    chooser: PickBanSide | null
    chooserName: string | null
    chooserReason: ChooserReason | null
    chooserBasis: PickBanChooserBasis | null
    chooserLine: string | null
    canChoose: boolean
    viewerChooses: boolean
    waiting: string | null
    reveal: PickBanSideReveal | null
    viewerColor: SideColor | null
    introLine: string | null
    notice: string | null
    cards: PickBanSideCardView[]
}

export interface PickBanVetoChoiceView {
    side: PickBanSide
    teamName: string
    choice: VetoChoice | null
}

export interface PickBanVetoReveal {
    id: string
    outcome: VetoOutcome
    side: PickBanSide | null
    teamName: string | null
    text: string
    mapCount: number
    revealAt: number | null
}

export interface PickBanVetoView {
    phase: PickBanVetoPhase | null
    active: boolean
    tag: string
    minPreCupSeed: number
    maps: string[]
    eligible: PickBanSide[]
    eligibleNames: string[]
    choices: PickBanVetoChoiceView[]
    outcome: VetoOutcome | null
    vetoedBy: PickBanSide | null
    vetoedByName: string | null
    poolSizes: PickBanVetoPoolSizes
    poolLine: string | null
    canVeto: boolean
    viewerEligible: boolean
    viewerChoice: VetoChoice | null
    viewerChooses: boolean
    waiting: string | null
    reveal: PickBanVetoReveal | null
}

export interface PickBanView {
    version: number
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
    side: PickBanSideView
    veto: PickBanVetoView | null
    banners: PickBanBanner[]
    affordances: PickBanAffordances
    edited: boolean
    setup: PickBanSetup
    nextBoundaryAt: number | null
    scene: PickBanScene
}

export type PickBanSceneKind =
    | 'none'
    | 'lobby'
    | 'intro'
    | 'veto_choice'
    | 'veto_reveal'
    | 'side_choice'
    | 'side_reveal'
    | 'turn'
    | 'reveal'
    | 'complete'
    | 'cancelled'
    | 'voided'

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


type LivePhase = 'lobby' | 'intro' | PickBanVetoPhase | PickBanSidePhase | 'awaiting' | 'spotlight' | 'complete'

interface LiveTiming {
    phase: LivePhase
    startsAt: number | null
    endsAt: number | null
}

interface Moment {
    state: PickBanViewState
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

const ENTRANCE_SHARE = 0.2

const PLAIN_ENTRANCE_MS = 350

export const INTRO_ENTRANCE_MAX_MS = 1_200

export const REVEAL_ENTRANCE_MAX_MS: { [segment in PickBanSegment]: number } = {
    lettered: 1_600,
    ban_down: 900,
    decider: 2_200,
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

export function introStartsAt(state: PickBanViewState): number | null {
    const introEnd = parseApiInstant(state.intro_ends_at)
    return introEnd === null ? null : introEnd - state.pacing.intro * 1000
}

function teamNameOf(state: PickBanViewState, side: PickBanSide | null): string | null {
    return side ? state.teams[side]?.name ?? null : null
}

function screenshotVersionOf(state: PickBanViewState, map: string | null): string | null {
    return map === null ? null : state.pool.find((card) => card.map === map)?.screenshot_version ?? null
}

function viewerActs(state: PickBanViewState, step: PickBanPlanStep): boolean {
    return !step.automatic && step.side !== null && step.side === state.capabilities.acting_side
}

function warningMessage(warning: PickBanWarning): string {
    if (typeof warning === 'string') return warning
    return warning.message || warning.code || 'Warning'
}

function exclusionReasonOf(state: PickBanViewState, exclusion: PickBanExclusion | null): string | null {
    if (!exclusion) return null
    const vetoedBy = vetoedByOf(exclusion)
    if (vetoedBy !== null) return `${exclusion.tag} maps are vetoed by ${teamNameOf(state, vetoedBy) ?? 'a team'}.`
    const triggers = exclusion.triggered_by
        .map((trigger) => `${teamNameOf(state, trigger.side) ?? trigger.team_id} has pre-cup seed ${trigger.pre_cup_seed}`)
        .join(' and ')
    if (!triggers) return `${exclusion.tag} maps are excluded for this match.`
    return `${exclusion.tag} maps are excluded because ${triggers} (${exclusion.min_pre_cup_seed} or higher).`
}

function vetoedByOf(exclusion: PickBanExclusion | null): PickBanSide | null {
    return exclusion?.mode === 'choice' ? exclusion.vetoed_by ?? null : null
}

function colorOfActor(actor: PickBanActor | null): SideColor | null {
    return actor === null ? null : sideColorOfLetter(actor)
}

function redSideOf(state: PickBanViewState): PickBanSide {
    return state.side.red ?? state.a_side ?? 'team_a'
}

function colorOfSide(state: PickBanViewState, side: PickBanSide): SideColor {
    return side === redSideOf(state) ? 'red' : 'blue'
}

function actorLabelForActor(state: PickBanViewState, actor: PickBanActor | null, side: PickBanSide | null): string {
    if (actor === null) return 'Decider'
    return teamNameOf(state, side) ?? sideColorName(sideColorOfLetter(actor))
}

function actorLabelOf(state: PickBanViewState, step: PickBanPlanStep): string {
    return actorLabelForActor(state, step.actor, step.side)
}

function abOfSide(state: PickBanViewState, side: PickBanSide | null): PickBanActor | null {
    return side === null ? null : side === state.a_side ? 'A' : 'B'
}

function actionLabelOf(state: PickBanViewState, step: PickBanPlanStep): string {
    if (step.action === 'decider') return 'Decider'
    return `${withSideColor(actorLabelOf(state, step), colorOfActor(step.actor))} ${step.action === 'ban' ? 'bans' : 'picks'}`
}

export function actionTagOf(turn: Pick<PickBanTurn, 'action' | 'actorLabel'>): string {
    if (turn.action === 'decider') return 'Decider'
    return `${turn.actorLabel} (${turn.action})`
}

const STAGE_PHASE_OF_LIVE_PHASE: Record<LivePhase, PickBanStagePhase> = {
    lobby: 'lobby',
    intro: 'intro',
    veto_choice: 'awaiting',
    veto_spotlight: 'spotlight',
    side_choice: 'awaiting',
    side_spotlight: 'spotlight',
    awaiting: 'awaiting',
    spotlight: 'spotlight',
    complete: 'complete',
}

function stagePhaseOf(status: PickBanSessionStatus, livePhase: LivePhase): PickBanStagePhase {
    if (status === 'none' || status === 'cancelled' || status === 'voided') return status
    return STAGE_PHASE_OF_LIVE_PHASE[livePhase]
}

function isSidePhase(phase: LivePhase): phase is PickBanSidePhase {
    return phase === 'side_choice' || phase === 'side_spotlight'
}

function isVetoPhase(phase: LivePhase): phase is PickBanVetoPhase {
    return phase === 'veto_choice' || phase === 'veto_spotlight'
}

function activeVetoOf(state: PickBanViewState): PickBanVeto | null {
    return state.veto?.active ? state.veto : null
}

function vetoChoiceOf(veto: PickBanVeto, side: PickBanSide): VetoChoice | null {
    return veto.choices[side] ?? null
}

export interface PickBanRevealedSteps {
    clock: number
    frozenAt: number | null
    steps: PickBanPlanStep[]
    revealed: PickBanPlanStep[]
}

export function revealedStepsAt(state: PickBanViewState, { clockOffsetMs, now }: PickBanClock): PickBanRevealedSteps {
    const frozenAt = state.status === 'paused' ? parseApiInstant(state.paused_at) : null
    const serverNow = now + clockOffsetMs
    const clock = frozenAt === null ? serverNow : Math.min(serverNow, frozenAt)
    const steps = [...state.plan].sort((a, b) => a.index - b.index)
    const revealed = steps.filter((step) => isRevealedAt(step, clock))
    return { clock, frozenAt, steps, revealed }
}

function momentOf(state: PickBanViewState, clockInput: PickBanClock): Moment {
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
    if (following.automatic) return Math.max(own, revealAtOf(following) ?? own)
    return own
}

function sideSpotlightEndOf(state: PickBanViewState): number | null {
    return state.side.source === 'step0' && state.phase === 'side_spotlight' ? parseApiInstant(state.phase_ends_at) : null
}

function vetoSpotlightEndOf(state: PickBanViewState): number | null {
    const veto = activeVetoOf(state)
    if (!veto || veto.outcome === null) return null
    const phaseEnd = state.phase === 'veto_spotlight' ? parseApiInstant(state.phase_ends_at) : null
    if (phaseEnd !== null) return phaseEnd
    const revealAt = parseApiInstant(veto.reveal_at)
    const length = state.pacing.veto_spotlight
    return revealAt === null || length === undefined ? null : revealAt + length * 1000
}

function vetoStepTiming(moment: Moment, introEnd: number | null): LiveTiming | null {
    const { state, clock } = moment
    const veto = activeVetoOf(state)
    if (!veto || moment.steps.some(isExecuted)) return null
    if (veto.outcome === null) return { phase: 'veto_choice', startsAt: introEnd, endsAt: null }
    const spotlightEnd = vetoSpotlightEndOf(state)
    if (spotlightEnd === null || clock >= spotlightEnd) return null
    return { phase: 'veto_spotlight', startsAt: parseApiInstant(veto.resolved_at), endsAt: spotlightEnd }
}

function sideStepTiming(moment: Moment, opensAt: number | null): LiveTiming | null {
    const { state, clock } = moment
    if (moment.steps.some(isExecuted)) return null
    if (state.side.red === null && state.side.chooser !== null) return { phase: 'side_choice', startsAt: opensAt, endsAt: null }
    const spotlightEnd = sideSpotlightEndOf(state)
    if (spotlightEnd === null || clock >= spotlightEnd) return null
    return { phase: 'side_spotlight', startsAt: parseApiInstant(state.side.set_at), endsAt: spotlightEnd }
}

function liveTiming(moment: Moment): LiveTiming {
    const { state, clock, lastRevealed, currentStep } = moment
    if (!LIVE_STATUSES.includes(state.status)) return IDLE_TIMING
    const introStart = introStartsAt(state)
    if (introStart !== null && clock < introStart) return IDLE_TIMING
    const introEnd = parseApiInstant(state.intro_ends_at)
    if (introEnd !== null && clock < introEnd) return { phase: 'intro', startsAt: introStart, endsAt: introEnd }
    const vetoStep = vetoStepTiming(moment, introEnd)
    if (vetoStep) return vetoStep
    const stepsOpenAt = vetoSpotlightEndOf(state) ?? introEnd
    const sideStep = sideStepTiming(moment, stepsOpenAt)
    if (sideStep) return sideStep
    const settledPhase = currentStep ? 'awaiting' : 'complete'
    if (lastRevealed) {
        const spotlightEnd = spotlightEndOf(moment, lastRevealed)
        if (clock < spotlightEnd) return { phase: 'spotlight', startsAt: revealAtOf(lastRevealed), endsAt: spotlightEnd }
        return { phase: settledPhase, startsAt: spotlightEnd, endsAt: null }
    }
    return { phase: settledPhase, startsAt: sideSpotlightEndOf(state) ?? stepsOpenAt, endsAt: null }
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

function managerControlsOf(moment: Moment, awaitedStep: PickBanPlanStep | null, livePhase: LivePhase): PickBanManagerControls | null {
    const { state, steps } = moment
    if (!state.capabilities.can_manage) return null
    const status = state.status
    const live = LIVE_STATUSES.includes(status)
    const humanStepIn = steps.some((step) => isExecuted(step) && !step.automatic)
    const lockForSide = state.viewer.side === null
    const beforeFirstStep = status === 'lobby' || (status === 'running' && !steps.some(isExecuted))
    const veto = activeVetoOf(state)
    const undoTarget = status === 'running' || status === 'paused' ? undoTargetOf(state, humanStepIn) : null
    return {
        open: status === 'none' || status === 'cancelled' || status === 'voided',
        start: status === 'lobby',
        startBlockedBy: status === 'lobby' ? state.blocking_reason : null,
        resultsPresent: state.results_present,
        sideChooser: status === 'lobby' && !(state.side.confirmed && state.side.source === 'admin'),
        setSides: beforeFirstStep,
        swap: state.a_side !== null && state.side.confirmed && beforeFirstStep,
        overrideSequence: status === 'lobby',
        pause: status === 'running',
        resume: status === 'paused',
        undo: undoTarget !== null,
        reopen: status === 'complete' && humanStepIn,
        restart: live,
        cancel: status === 'lobby' || live,
        handOver: status === 'lobby' || status === 'running' || status === 'paused',
        editFinal: status === 'complete' && livePhase === 'complete',
        lockForSide,
        actForSide: lockForSide && status === 'running' && awaitedStep ? awaitedStep.side : null,
        actForSideChoice: lockForSide && status === 'running' && livePhase === 'side_choice' ? state.side.chooser : null,
        actForVeto: lockForSide && status === 'running' && livePhase === 'veto_choice' && veto
            ? veto.eligible.filter((side) => vetoChoiceOf(veto, side) === null)
            : [],
        undoTarget,
    }
}

function undoTargetOf(state: PickBanViewState, humanStepIn: boolean): PickBanUndoTarget | null {
    if (humanStepIn) return 'step'
    if (!activeVetoOf(state)?.outcome) return null
    return state.side.confirmed && state.side.source === 'step0' ? 'side' : 'veto'
}

function affordancesOf(moment: Moment, awaitedStep: PickBanPlanStep | null, livePhase: LivePhase): PickBanAffordances {
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
        manager: managerControlsOf(moment, awaitedStep, livePhase),
    }
}

function timelineOf(moment: Moment, inProgress: boolean, revealingIndex: number | null): PickBanTimelineEntry[] {
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
            color: colorOfActor(step.actor),
            actorLabel: actorLabelOf(state, step),
            actionLabel: actionLabelOf(state, step),
            mapNumber: step.map_number,
            status,
            map: revealed ? step.map : null,
            screenshotVersion: revealed ? screenshotVersionOf(state, step.map) : null,
            actedBy: revealed ? step.acted_by : null,
            actedByAdmin: revealed && step.acted_by_admin,
            automatic: step.automatic,
            revealAt: revealAt === null ? null : moment.toLocal(revealAt),
            revealing: step.index === revealingIndex,
        }
    })
}

function skippedBansOf(state: PickBanViewState): PickBanSkippedBan[] {
    return state.skipped_bans.map((skipped, order) => ({
        key: `skipped-${order}`,
        actor: skipped.actor,
        beforeIndex: skipped.before_index,
    }))
}

function cardsOf(moment: Moment, awaitedStep: PickBanPlanStep | null, canChoose: boolean, revealingIndex: number | null): PickBanCardView[] {
    const { state, pendingStep } = moment
    const revealedByMap = new Map(moment.revealedSteps.map((step) => [step.map, step]))
    const preview = state.selection_preview
    return state.pool.map((poolCard) => {
        const step = revealedByMap.get(poolCard.map)
        let cardState: PickBanCardState = 'available'
        if (step) cardState = CARD_STATE_OF_ACTION[step.action]
        else if (poolCard.excluded) cardState = 'excluded'
        const available = cardState === 'available'
        const vetoedBy = vetoedByOf(poolCard.exclusion)
        const pendingChoice = available && poolCard.pending_choice === true
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
            pendingChoice,
            pendingLabel: pendingChoice ? `${state.veto?.tag ?? poolCard.tags[0] ?? 'Map'}?` : null,
            vetoedBy,
            vetoedByName: teamNameOf(state, vetoedBy),
            previewed: available
                && awaitedStep !== null
                && preview !== null
                && preview.map === poolCard.map
                && preview.side === awaitedStep.side,
            lockedIn: pendingStep !== null && viewerActs(state, pendingStep) && pendingStep.map === poolCard.map,
            selected: false,
            selectable: available && canChoose,
            revealing: step !== undefined && step.index === revealingIndex,
        }
    })
}

function finalSummaryOf(state: PickBanViewState, finalMaps: PickBanFinalMap[]): PickBanSummaryEntry[] {
    return [...finalMaps]
        .sort((a, b) => a.map_number - b.map_number)
        .map((entry) => {
            const ab = abOfSide(state, entry.side)
            return {
                key: entry.map_number,
                mapNumber: entry.map_number,
                stepIndex: state.plan.find((step) => step.map_number === entry.map_number)?.index ?? null,
                map: entry.map,
                screenshotVersion: screenshotVersionOf(state, entry.map),
                side: entry.side,
                ab,
                actorLabel: actorLabelForActor(state, ab, entry.side),
                decider: entry.decider,
            }
        })
}

function summaryOf(moment: Moment): PickBanSummaryEntry[] {
    const { state, clock } = moment
    if (state.edited && state.final_maps !== null) return finalSummaryOf(state, state.final_maps)
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
        color: colorOfActor(currentStep.actor),
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
        color: colorOfSide(state, side),
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

function matchHeadingOf(state: PickBanViewState, leftSide: PickBanSide): PickBanMatchHeading {
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

const SIDE_INTRO_LINES: Record<MatchSideSource, string | null> = {
    step0: null,
    admin: 'Sides set by admin',
    caster: 'Sides set by the caster',
    backfill: 'Sides already set',
}

const SIDES_CHANGED_NOTICE = 'Sides changed by admin. Remaining steps follow the new colours.'

const ORDINALS = ['1st', '2nd']

const ORDINAL_WORDS = ['first', 'second']

interface ActionLead {
    action: PickBanSequenceAction
    order: number
}

function firstStepOf(card: PickBanSideCard | undefined, action: PickBanSequenceAction): number {
    return card?.steps.find((step) => step.action === action)?.n ?? Infinity
}

function actionLeadsOf(card: PickBanSideCard, other: PickBanSideCard | undefined): ActionLead[] {
    const actions = [...new Set(card.steps.map((step) => step.action))]
    return actions.map((action) => ({ action, order: firstStepOf(card, action) < firstStepOf(other, action) ? 0 : 1 }))
}

function leadOf(card: PickBanSideCard, other: PickBanSideCard | undefined): string {
    const lead = actionLeadsOf(card, other).map(({ action, order }) => `${action} ${ORDINALS[order]}`).join(', ')
    return lead.charAt(0).toUpperCase() + lead.slice(1)
}

function cardStepLabel(action: PickBanSequenceAction, segment: PickBanSegment, mapNumber: number | null): string {
    if (action === 'pick') return mapNumber === null ? 'Pick' : `Pick map ${mapNumber}`
    return segment === 'ban_down' ? 'Ban (ban-down)' : 'Ban'
}

function sideCardsOf(moment: Moment): PickBanSideCardView[] {
    const { cards } = moment.state.side
    return cards.map((card) => {
        const other = cards.find((candidate) => candidate.color !== card.color)
        return {
            color: card.color,
            letter: card.letter,
            title: sideColorTitle(card.color),
            lead: leadOf(card, other),
            steps: card.steps.map((step) => {
                const mapNumber = moment.steps.find((planStep) => planStep.index === step.n - 1)?.map_number ?? null
                return { number: step.n, action: step.action, segment: step.segment, mapNumber, label: cardStepLabel(step.action, step.segment, mapNumber) }
            }),
        }
    })
}

function sideRevealOf(state: PickBanViewState): PickBanSideReveal {
    const side = state.side.chooser ?? redSideOf(state)
    const color = colorOfSide(state, side)
    const teamName = teamNameOf(state, side) ?? sideColorName(color)
    const card = state.side.cards.find((candidate) => candidate.color === color)
    const opening = card ? actionLeadsOf(card, state.side.cards.find((candidate) => candidate !== card))[0] : undefined
    const what = opening ? ` · ${opening.action}s ${ORDINAL_WORDS[opening.order]}` : ''
    return { side, teamName, color, text: `${teamName} → ${sideColorTag(color)}${what}` }
}

function sideViewOf(moment: Moment, livePhase: LivePhase): PickBanSideView {
    const { state } = moment
    const { side } = state
    const phase = isSidePhase(livePhase) ? livePhase : null
    const chooserName = side.chooser === null ? null : teamNameOf(state, side.chooser) ?? 'TBD'
    return {
        phase,
        red: redSideOf(state),
        confirmed: side.confirmed,
        tbc: !side.confirmed,
        source: side.source,
        chooser: side.chooser,
        chooserName,
        chooserReason: side.chooser_reason,
        chooserBasis: side.chooser_basis ?? null,
        chooserLine: chooserName !== null && side.chooser_reason !== null ? chooserLine(chooserName, side.chooser_reason, side.chooser_basis) : null,
        canChoose: phase === 'side_choice' && state.status === 'running' && state.capabilities.can_choose_side,
        viewerChooses: phase === 'side_choice' && side.chooser !== null && side.chooser === state.capabilities.acting_side,
        waiting: phase === 'side_choice' ? `${chooserName ?? 'A team'} are choosing their side` : null,
        reveal: phase === 'side_spotlight' ? sideRevealOf(state) : null,
        viewerColor: side.confirmed && state.viewer.side !== null ? colorOfSide(state, state.viewer.side) : null,
        introLine: side.confirmed && side.source !== null ? SIDE_INTRO_LINES[side.source] : null,
        notice: side.changed_mid_veto ? SIDES_CHANGED_NOTICE : null,
        cards: sideCardsOf(moment),
    }
}

function joinTeamNames(names: string[]): string {
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? 'The teams'
}

function vetoRevealOf(moment: Moment, veto: PickBanVeto, outcome: VetoOutcome): PickBanVetoReveal {
    const revealAt = parseApiInstant(veto.reveal_at)
    const side = outcome === 'vetoed' ? veto.vetoed_by : null
    const teamName = teamNameOf(moment.state, side)
    return {
        id: veto.resolved_at ?? veto.reveal_at ?? outcome,
        outcome,
        side,
        teamName,
        text: outcome === 'vetoed' ? `${teamName ?? 'A team'} veto the ${veto.tag} maps` : `${veto.tag} maps stay in`,
        mapCount: outcome === 'vetoed' ? veto.pool_sizes.vetoed : veto.pool_sizes.played,
        revealAt: revealAt === null ? null : moment.toLocal(revealAt),
    }
}

function vetoWaitingOf(veto: PickBanVeto, choices: PickBanVetoChoiceView[], viewer: PickBanVetoChoiceView | null): string | null {
    if (viewer?.choice === null) return null
    const deciding = joinTeamNames(choices.filter((entry) => entry.choice === null).map((entry) => entry.teamName))
    return viewer ? `Waiting for ${deciding}` : `${deciding} are deciding on the ${veto.tag} maps`
}

function vetoViewOf(moment: Moment, livePhase: LivePhase): PickBanVetoView | null {
    const { state } = moment
    const { veto } = state
    if (!veto) return null
    const phase = isVetoPhase(livePhase) ? livePhase : null
    const choosing = phase === 'veto_choice'
    const choices = veto.eligible.map((side) => ({ side, teamName: teamNameOf(state, side) ?? 'TBD', choice: vetoChoiceOf(veto, side) }))
    const viewer = choices.find((entry) => entry.side === state.capabilities.acting_side) ?? null
    return {
        phase,
        active: veto.active,
        tag: veto.tag,
        minPreCupSeed: veto.min_pre_cup_seed,
        maps: veto.maps,
        eligible: veto.eligible,
        eligibleNames: choices.map((entry) => entry.teamName),
        choices,
        outcome: veto.outcome,
        vetoedBy: veto.vetoed_by,
        vetoedByName: teamNameOf(state, veto.vetoed_by),
        poolSizes: veto.pool_sizes,
        poolLine: veto.active && veto.outcome === null ? `${veto.pool_sizes.played} or ${veto.pool_sizes.vetoed} maps` : null,
        canVeto: choosing && state.status === 'running' && state.capabilities.can_veto === true,
        viewerEligible: viewer !== null,
        viewerChoice: viewer?.choice ?? null,
        viewerChooses: choosing && viewer !== null && viewer.choice === null,
        waiting: choosing ? vetoWaitingOf(veto, choices, viewer) : null,
        reveal: phase === 'veto_spotlight' && veto.outcome !== null ? vetoRevealOf(moment, veto, veto.outcome) : null,
    }
}

function setupOf(state: PickBanViewState): PickBanSetup {
    const { sequence } = state
    return {
        sequence: sequence && {
            presetId: sequence.preset_id,
            stageKey: sequence.from_stage_key,
            ownStage: sequence.from_stage_key === state.match.stage_key,
        },
    }
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

export function buildPickBanView(state: PickBanViewState, clock: PickBanClock): PickBanView {
    const moment = momentOf(state, clock)
    const timing = liveTiming(moment)
    const inProgress = timing.phase === 'intro' || timing.phase === 'awaiting' || timing.phase === 'spotlight' || timing.phase === 'side_spotlight'
    const awaitedStep = timing.phase === 'awaiting' && !moment.pendingStep ? moment.currentStep : null
    const affordances = affordancesOf(moment, awaitedStep, timing.phase)
    const canChoose = affordances.canLock || (affordances.manager?.actForSide ?? null) !== null
    const stagePhase = stagePhaseOf(state.status, timing.phase)
    const scene = sceneOf(moment, stagePhase, timing)
    const revealingIndex = revealingIndexOf(moment, scene)
    const timeline = timelineOf(moment, inProgress, revealingIndex)
    const spotlightIndex = timing.phase === 'spotlight' ? moment.lastRevealed?.index : undefined
    const leftSide = state.a_side ?? 'team_a'

    return {
        version: state.version,
        match: matchHeadingOf(state, leftSide),
        status: state.status,
        phase: state.status === 'paused' ? 'paused' : stagePhase,
        stagePhase,
        countdown: countdownOf(moment, timing),
        turn: turnOf(moment, inProgress),
        spotlight: timeline.find((entry) => entry.index === spotlightIndex) ?? null,
        cards: cardsOf(moment, awaitedStep, canChoose, revealingIndex),
        timeline,
        skippedBans: skippedBansOf(state),
        summary: summaryOf(moment),
        teams: { left: panelOf(moment, leftSide, awaitedStep), right: panelOf(moment, otherSide(leftSide), awaitedStep) },
        side: sideViewOf(moment, timing.phase),
        veto: vetoViewOf(moment, timing.phase),
        banners: bannersOf(moment),
        affordances,
        edited: state.edited,
        setup: setupOf(state),
        nextBoundaryAt: nextBoundaryOf(moment, timing),
        scene,
    }
}

type SceneIdentity = Pick<PickBanScene, 'key' | 'kind' | 'position'>

function sceneIdentityOf(moment: Moment, stagePhase: PickBanStagePhase, livePhase: LivePhase): SceneIdentity {
    const { currentStep, lastRevealed, steps } = moment
    const end = 2 + 2 * steps.length
    if (livePhase === 'veto_choice') return { key: 'veto-choice', kind: 'veto_choice', position: 1.1 }
    if (livePhase === 'veto_spotlight') return { key: 'veto-reveal', kind: 'veto_reveal', position: 1.2 }
    if (livePhase === 'side_choice') return { key: 'side-choice', kind: 'side_choice', position: 1.25 }
    if (livePhase === 'side_spotlight') return { key: 'side-reveal', kind: 'side_reveal', position: 1.5 }
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

export function entranceMsFor(pacing: PickBanPacing, entrance: 'intro' | PickBanSegment): number {
    if (entrance === 'intro') return Math.min(INTRO_ENTRANCE_MAX_MS, pacing.intro * 1000 * ENTRANCE_SHARE)
    return Math.min(REVEAL_ENTRANCE_MAX_MS[entrance], spotlightLengthMs(pacing, entrance) * ENTRANCE_SHARE)
}

function entranceMsOf(moment: Moment, kind: PickBanSceneKind): number {
    const { pacing } = moment.state
    if (kind === 'intro') return entranceMsFor(pacing, 'intro')
    if (kind !== 'reveal' || !moment.lastRevealed) return PLAIN_ENTRANCE_MS
    return entranceMsFor(pacing, moment.lastRevealed.segment)
}

function sceneOf(moment: Moment, stagePhase: PickBanStagePhase, timing: LiveTiming): PickBanScene {
    const identity = sceneIdentityOf(moment, stagePhase, timing.phase)
    return {
        ...identity,
        elapsedMs: timing.startsAt === null ? null : moment.clock - timing.startsAt,
        entranceMs: entranceMsOf(moment, identity.kind),
    }
}

function revealingIndexOf(moment: Moment, scene: PickBanScene): number | null {
    if (scene.kind !== 'reveal' || scene.elapsedMs === null || scene.elapsedMs > scene.entranceMs) return null
    return moment.lastRevealed?.index ?? null
}

export function sceneDirection(previous: PickBanScene | null, next: PickBanScene): PickBanSceneDirection {
    if (previous === null || previous.key === next.key) return 0
    return next.position < previous.position ? -1 : 1
}

export function playsEntrance(scene: PickBanScene, direction: PickBanSceneDirection): boolean {
    return direction < 0 || scene.elapsedMs === null || scene.elapsedMs <= scene.entranceMs
}
