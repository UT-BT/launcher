import {
    PICK_BAN_PRESET_IDS,
    pickBanErrorCode,
    type PickBanActor,
    type PickBanBlockingReason,
    type PickBanErrorCode,
    type PickBanManagerCommand,
    type PickBanManagerCommandBodies,
    type PickBanMember,
    type PickBanSide,
    type PickBanStageConfig,
} from '@/app/utils/api'
import { withOptimisticLock, type CaptainControls, type CaptainDock } from './captainPlay'
import { PICK_BAN_PRESET_LABELS } from './pickBanCopy'
import { blockingReasonLabel } from './pickBanStatus'
import type { PickBanBanner, PickBanManagerControls, PickBanTeamPanel, PickBanView } from './pickBanView'

export type ManagerCommand = Exclude<PickBanManagerCommand, 'edit-final'>

type ButtonCommand = 'open' | 'start' | 'swap' | 'pause' | 'resume' | 'undo' | 'restart' | 'cancel'

type BodyOf<C extends ManagerCommand> = Omit<PickBanManagerCommandBodies[C], 'version'>

export type ManagerRequest =
    | { command: ButtonCommand }
    | { command: 'choose-a'; body: BodyOf<'choose-a'> }
    | { command: 'override-sequence'; body: BodyOf<'override-sequence'> }
    | { command: 'hand-over'; body: BodyOf<'hand-over'> }
    | { command: 'lock'; body: BodyOf<'lock'> }

type ConfirmedCommand = 'restart' | 'cancel'

interface StepChoice {
    stepIndex: number
    map: string
}

export interface ManagerPlay {
    selection: StepChoice | null
    submitting: ManagerCommand | null
    lockingIn: StepChoice | null
    confirming: ConfirmedCommand | null
    rejected: ManagerCommand | null
    rejection: string | null
}

export interface ManagerButton {
    command: ButtonCommand
    label: string
    disabled: boolean
}

export interface ManagerConfirm {
    command: ConfirmedCommand
    title: string
    message: string
    confirmLabel: string
}

export interface ManagerAChoice {
    side: PickBanSide
    name: string
    chosen: boolean
}

export interface ManagerHandOverMember {
    member: PickBanMember
    controls: boolean
    userId: string | null
}

export interface ManagerHandOverTeam {
    side: PickBanSide
    ab: PickBanActor | null
    name: string
    members: ManagerHandOverMember[]
}

export interface ManagerSequenceChoice {
    label: string
    body: BodyOf<'override-sequence'>
}

export interface ManagerActFor {
    side: PickBanSide | null
    ab: PickBanActor | null
    teamName: string
    dock: CaptainDock
}

export interface ManagerDock {
    busy: boolean
    buttons: ManagerButton[]
    startBlockedBy: string | null
    resultsWarning: string | null
    voided: Extract<PickBanBanner, { kind: 'voided' }> | null
    chooseA: ManagerAChoice[] | null
    overrideSequence: boolean
    handOver: ManagerHandOverTeam[] | null
    confirm: ManagerConfirm | null
    actFor: ManagerActFor | null
    rejection: string | null
}

export interface ManagerSubmission {
    play: ManagerPlay
    request: ManagerRequest | null
}

export const IDLE_MANAGER_PLAY: ManagerPlay = {
    selection: null,
    submitting: null,
    lockingIn: null,
    confirming: null,
    rejected: null,
    rejection: null,
}

const CONTROL_OF: Record<Exclude<ManagerCommand, 'lock'>, keyof PickBanManagerControls> = {
    open: 'open',
    start: 'start',
    'choose-a': 'chooseA',
    swap: 'swap',
    'override-sequence': 'overrideSequence',
    pause: 'pause',
    resume: 'resume',
    undo: 'undo',
    restart: 'restart',
    cancel: 'cancel',
    'hand-over': 'handOver',
}

const BUTTON_LABELS: Record<ButtonCommand, string> = {
    open: 'Open lobby',
    start: 'Start',
    swap: 'Swap A/B',
    pause: 'Pause',
    resume: 'Resume',
    undo: 'Undo last step',
    restart: 'Restart',
    cancel: 'Cancel pick/ban',
}

const RESULTS_WARNING = 'Results are already entered for this match, so the pick/ban can’t start or change the maps it wrote.'

const CONFIRMATIONS: Record<ConfirmedCommand, Pick<ManagerConfirm, 'title' | 'message'>> = {
    restart: {
        title: 'Restart the pick/ban?',
        message: 'Every ban and pick so far is undone and both teams go back to the lobby. Both Ready marks clear, and any maps this pick/ban wrote into the match are removed.',
    },
    cancel: {
        title: 'Cancel the pick/ban?',
        message: 'This ends the pick/ban for good. Its bans and picks won’t count, and any maps it wrote into the match are removed. You can open a new lobby afterwards.',
    },
}

const REJECTIONS: Record<Exclude<PickBanErrorCode, PickBanBlockingReason>, string> = {
    not_authorized: 'You can’t manage this pick/ban any more.',
    not_your_turn: 'That team isn’t on the clock any more.',
    session_exists: 'This match already has a pick/ban open.',
    intro_active: 'Wait for the intro to finish, then lock in.',
    spotlight_active: 'Wait for the reveal to finish, then lock in.',
    paused: 'The pick/ban is paused. Resume it first.',
    map_unavailable: 'That map can’t be chosen any more. Select another.',
    version_conflict: 'The session changed just before your click. Check it and try again.',
    invalid_request: 'The server didn’t accept that request. Refresh the page and try again.',
    no_session: 'This match has no pick/ban session any more.',
    match_live: 'The match is already live, so a lobby can’t open.',
    wrong_status: 'The session moved on just before your click, so that no longer applies.',
}

function rejectionMessage(error: unknown): string {
    const code = pickBanErrorCode(error)
    if (code) return code in REJECTIONS ? REJECTIONS[code as keyof typeof REJECTIONS] : `${blockingReasonLabel(code, 'lobby')}.`
    if (error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError')) {
        return 'Couldn’t reach the server. Check your connection and try again.'
    }
    return error instanceof Error && error.message ? error.message : 'Something went wrong. Try again.'
}

function needsConfirmation(command: ManagerCommand): command is ConfirmedCommand {
    return command in CONFIRMATIONS
}

function allowed(controls: PickBanManagerControls, command: ManagerCommand): boolean {
    if (command === 'lock') return false
    if (command === 'start' && controls.startBlockedBy !== null) return false
    return Boolean(controls[CONTROL_OF[command]])
}

function panelsOf(view: PickBanView): PickBanTeamPanel[] {
    return [view.teams.left, view.teams.right].filter((panel): panel is PickBanTeamPanel => panel !== null)
}

function handOverTeamOf({ side, ab, name, members }: PickBanTeamPanel): ManagerHandOverTeam {
    const handedOver = members.some((member) => member.acting_captain)
    return {
        side,
        ab,
        name,
        members: members.map((member) => ({
            member,
            controls: handedOver ? member.acting_captain : member.captain,
            userId: member.captain ? null : member.id,
        })),
    }
}

export function sequenceChoices(stages: PickBanStageConfig[]): ManagerSequenceChoice[] {
    return [
        ...PICK_BAN_PRESET_IDS.map((id) => ({ label: PICK_BAN_PRESET_LABELS[id], body: { preset_id: id } })),
        ...stages
            .filter((stage) => stage.pick_ban)
            .map((stage) => ({ label: `${stage.name} (Bo${stage.best_of})`, body: { from_stage_key: stage.key } })),
    ]
}

function actForOpen(view: PickBanView): boolean {
    return Boolean(view.affordances.manager?.actForSide && view.turn && !view.turn.viewerActs)
}

function selectedMapOf(view: PickBanView, play: ManagerPlay): string | null {
    const { turn } = view
    if (!turn || !actForOpen(view) || play.selection?.stepIndex !== turn.stepIndex) return null
    const map = play.selection.map
    return view.cards.some((card) => card.map === map && card.selectable) ? map : null
}

function optimisticLockOf(view: PickBanView, play: ManagerPlay): string | null {
    const { turn } = view
    if (!turn || turn.lockedIn || play.lockingIn?.stepIndex !== turn.stepIndex) return null
    if (play.submitting !== 'lock' && view.affordances.manager?.actForSide) return null
    return play.lockingIn.map
}

export function withManagerPlay(view: PickBanView, play: ManagerPlay): PickBanView {
    const lockingIn = optimisticLockOf(view, play)
    if (lockingIn !== null) return withOptimisticLock(view, lockingIn)
    const selectedMap = selectedMapOf(view, play)
    if (selectedMap === null) return view
    return { ...view, cards: view.cards.map((card) => (card.map === selectedMap ? { ...card, selected: true } : card)) }
}

function actForControlsOf(view: PickBanView, play: ManagerPlay): CaptainControls | null {
    const { turn } = view
    const lockingIn = optimisticLockOf(view, play)
    if (lockingIn !== null) return { kind: 'locked_in', map: lockingIn }
    if (!turn || !actForOpen(view)) return null
    const selectedMap = selectedMapOf(view, play)
    return {
        kind: 'choose',
        action: turn.action,
        mapNumber: turn.mapNumber,
        selectedMap,
        canLockIn: selectedMap !== null && play.submitting === null,
    }
}

function actForOf(view: PickBanView, play: ManagerPlay): ManagerActFor | null {
    const controls = actForControlsOf(view, play)
    const rejection = play.rejected === 'lock' ? play.rejection : null
    if (!controls && rejection === null) return null
    return {
        side: view.turn?.side ?? null,
        ab: view.turn?.ab ?? null,
        teamName: view.turn?.actorLabel ?? '',
        dock: { controls, rejection },
    }
}

export function managerDockOf(view: PickBanView, play: ManagerPlay): ManagerDock | null {
    const controls = view.affordances.manager
    if (!controls) return null
    const busy = play.submitting !== null
    return {
        busy,
        buttons: (Object.keys(BUTTON_LABELS) as ButtonCommand[])
            .filter((command) => controls[CONTROL_OF[command]])
            .map((command) => ({ command, label: BUTTON_LABELS[command], disabled: busy || !allowed(controls, command) })),
        startBlockedBy: controls.startBlockedBy && blockingReasonLabel(controls.startBlockedBy, view.status),
        resultsWarning: controls.resultsPresent ? RESULTS_WARNING : null,
        voided: view.banners.find((banner) => banner.kind === 'voided') ?? null,
        chooseA: controls.chooseA
            ? panelsOf(view).map(({ side, name, ab }) => ({ side, name, chosen: ab === 'A' }))
            : null,
        overrideSequence: controls.overrideSequence,
        handOver: controls.handOver ? panelsOf(view).map(handOverTeamOf) : null,
        confirm: play.confirming && allowed(controls, play.confirming)
            ? { command: play.confirming, ...CONFIRMATIONS[play.confirming], confirmLabel: BUTTON_LABELS[play.confirming] }
            : null,
        actFor: actForOf(view, play),
        rejection: play.rejected === 'lock' ? null : play.rejection,
    }
}

export function beginManagerCommand(play: ManagerPlay, view: PickBanView, request: ManagerRequest): ManagerSubmission | null {
    const controls = view.affordances.manager
    if (!controls || play.submitting !== null || !allowed(controls, request.command)) return null
    if (needsConfirmation(request.command) && play.confirming !== request.command) {
        return { play: { ...play, confirming: request.command }, request: null }
    }
    return { play: { ...play, submitting: request.command, lockingIn: null, confirming: null, rejected: null, rejection: null }, request }
}

export function confirmManagerCommand(play: ManagerPlay, view: PickBanView): ManagerSubmission | null {
    return play.confirming ? beginManagerCommand(play, view, { command: play.confirming }) : null
}

export function dismissManagerConfirm(play: ManagerPlay): ManagerPlay {
    return { ...play, confirming: null }
}

export function settleManagerPlay(play: ManagerPlay, view: PickBanView): ManagerPlay {
    const controls = view.affordances.manager
    const staleConfirm = play.confirming !== null && !(controls && allowed(controls, play.confirming))
    const staleLock = play.lockingIn !== null && play.submitting === null && optimisticLockOf(view, play) === null
    if (!staleConfirm && !staleLock) return play
    return { ...play, confirming: staleConfirm ? null : play.confirming, lockingIn: staleLock ? null : play.lockingIn }
}

export function selectActForMap(play: ManagerPlay, view: PickBanView, map: string): ManagerPlay {
    const { turn } = view
    if (!turn || !actForOpen(view) || optimisticLockOf(view, play) !== null) return play
    if (!view.cards.some((card) => card.map === map && card.selectable)) return play
    return { ...play, selection: { stepIndex: turn.stepIndex, map }, rejected: null, rejection: null }
}

export function beginActForLock(play: ManagerPlay, view: PickBanView): ManagerSubmission | null {
    const { turn } = view
    const controls = actForControlsOf(view, play)
    if (!turn?.side || controls?.kind !== 'choose' || !controls.canLockIn || controls.selectedMap === null) return null
    const choice = { stepIndex: turn.stepIndex, map: controls.selectedMap }
    return {
        play: { ...play, submitting: 'lock', lockingIn: choice, rejected: null, rejection: null },
        request: { command: 'lock', body: { side: turn.side, map: choice.map, plan_index: choice.stepIndex } },
    }
}

export function managerCommandSucceeded(play: ManagerPlay): ManagerPlay {
    return { ...play, submitting: null, selection: null }
}

export function managerCommandRejected(play: ManagerPlay, error: unknown): ManagerPlay {
    return { ...play, submitting: null, lockingIn: null, rejected: play.submitting, rejection: rejectionMessage(error) }
}

export function dismissManagerRejection(play: ManagerPlay): ManagerPlay {
    return { ...play, rejected: null, rejection: null }
}
