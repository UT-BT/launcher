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
import {
    selectedMapOf,
    unwordedRejection,
    withOptimisticLock,
    withSelectedMap,
    type CaptainControls,
    type CaptainDock,
    type StepChoice,
} from './captainPlay'
import { finalDraftOf, finalEditorOf, type FinalDraft, type FinalEditor } from './editFinal'
import { PICK_BAN_PRESET_LABELS } from './pickBanCopy'
import { blockingReasonLabel } from './pickBanStatus'
import type { PickBanBanner, PickBanManagerControls, PickBanTeamPanel, PickBanView } from './pickBanView'

type ButtonCommand = 'open' | 'start' | 'swap' | 'pause' | 'resume' | 'undo' | 'restart' | 'cancel'

type WithoutVersion<B> = B extends unknown ? Omit<B, 'version'> : never

type BodyOf<C extends PickBanManagerCommand> = WithoutVersion<PickBanManagerCommandBodies[C]>

type BodyRequest =
    | { command: 'choose-a'; body: BodyOf<'choose-a'> }
    | { command: 'override-sequence'; body: BodyOf<'override-sequence'> }
    | { command: 'hand-over'; body: BodyOf<'hand-over'> }
    | { command: 'lock'; body: BodyOf<'lock'> }

export type ManagerRequest =
    | { command: ButtonCommand; version?: number }
    | BodyRequest
    | { command: 'edit-final'; body: BodyOf<'edit-final'>; version: number }

export type ManagerAction = { command: ButtonCommand } | { command: 'reopen' } | { command: 'edit-final' } | BodyRequest

export type ManagerCommand = ManagerAction['command']

type ButtonAction = ButtonCommand | 'reopen'

type ConfirmedCommand = 'reopen' | 'restart' | 'cancel' | 'edit-final'

interface PendingConfirmation {
    command: ConfirmedCommand
    request: ManagerRequest
}

export interface ManagerPlay {
    selection: StepChoice | null
    submitting: ManagerCommand | null
    lockingIn: StepChoice | null
    confirming: PendingConfirmation | null
    editing: FinalDraft | null
    rejected: ManagerCommand | null
    rejection: string | null
}

export interface ManagerButton {
    command: ButtonAction
    label: string
    disabled: boolean
}

export interface ManagerConfirm {
    command: ConfirmedCommand
    title: string
    message: string
    confirmLabel: string
    dismissLabel: string
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
    key: string
    label: string
    body: BodyOf<'override-sequence'>
}

export interface ManagerFinalEditor extends FinalEditor {
    saving: boolean
    rejection: string | null
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
    editFinal: boolean
    finalEditor: ManagerFinalEditor | null
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
    editing: null,
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
    reopen: 'reopen',
    restart: 'restart',
    cancel: 'cancel',
    'hand-over': 'handOver',
    'edit-final': 'editFinal',
}

const BUTTON_LABELS: Record<ButtonAction, string> = {
    open: 'Open lobby',
    start: 'Start',
    swap: 'Swap A/B',
    pause: 'Pause',
    resume: 'Resume',
    undo: 'Undo last step',
    reopen: 'Reopen',
    restart: 'Restart',
    cancel: 'Cancel pick/ban',
}

const RESULTS_WARNING = 'Results are already entered for this match, so the pick/ban can’t start or change the maps it wrote.'

const KEEP_IT = 'Keep it'

const CONFIRMATIONS: Record<ConfirmedCommand, Omit<ManagerConfirm, 'command'>> = {
    reopen: {
        title: 'Reopen the pick/ban?',
        message: 'The last ban or pick is undone, with the decider after it if there is one, and the pick/ban waits on that step again. The maps it wrote into the match are removed, and any edits to the final maps are discarded.',
        confirmLabel: BUTTON_LABELS.reopen,
        dismissLabel: KEEP_IT,
    },
    restart: {
        title: 'Restart the pick/ban?',
        message: 'Every ban and pick so far is undone and both teams go back to the lobby. Both Ready marks clear, and any maps this pick/ban wrote into the match are removed.',
        confirmLabel: BUTTON_LABELS.restart,
        dismissLabel: KEEP_IT,
    },
    cancel: {
        title: 'Cancel the pick/ban?',
        message: 'This ends the pick/ban for good. Its bans and picks won’t count, and any maps it wrote into the match are removed. You can open a new lobby afterwards.',
        confirmLabel: BUTTON_LABELS.cancel,
        dismissLabel: KEEP_IT,
    },
    'edit-final': {
        title: 'Save the edited final maps?',
        message: 'The match’s maps are rewritten to your list, in its order, with the picks and decider you set. The final summary is marked Edited, and the timeline keeps the bans and picks as they were played.',
        confirmLabel: 'Save final maps',
        dismissLabel: 'Keep editing',
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
    nothing_to_undo: 'There’s no ban or pick to undo.',
}

const COMMAND_REJECTIONS: Partial<Record<ManagerCommand, Partial<Record<PickBanErrorCode, (detail: string) => string>>>> = {
    'hand-over': {
        invalid_request: () => 'That player can’t take control: pick an active roster member of that side’s team.',
    },
    'edit-final': {
        invalid_request: (detail) => `The server didn’t accept that final list. ${detail}`,
        version_conflict: () => 'The final maps changed since you opened the editor.',
    },
}

function rejectionMessage(command: ManagerCommand | null, error: unknown): string {
    const code = pickBanErrorCode(error)
    const worded = command && code ? COMMAND_REJECTIONS[command]?.[code] : undefined
    if (worded) return worded(error instanceof Error ? error.message : '')
    if (code) return code in REJECTIONS ? REJECTIONS[code as keyof typeof REJECTIONS] : `${blockingReasonLabel(code, 'lobby')}.`
    return unwordedRejection(error)
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
        ...PICK_BAN_PRESET_IDS.map((id) => ({ key: `preset:${id}`, label: PICK_BAN_PRESET_LABELS[id], body: { preset_id: id } })),
        ...stages
            .filter((stage) => stage.pick_ban)
            .map((stage) => ({ key: `stage:${stage.key}`, label: `${stage.name} (Bo${stage.best_of})`, body: { from_stage_key: stage.key } })),
    ]
}

function actForOpen(view: PickBanView): boolean {
    return Boolean(view.affordances.manager?.actForSide && view.turn && !view.turn.viewerActs)
}

function actForSelectionOf(view: PickBanView, play: ManagerPlay): string | null {
    return actForOpen(view) ? selectedMapOf(view, play) : null
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
    return withSelectedMap(view, actForSelectionOf(view, play))
}

function actForControlsOf(view: PickBanView, play: ManagerPlay): CaptainControls | null {
    const { turn, countdown } = view
    const lockingIn = optimisticLockOf(view, play)
    if (lockingIn !== null) return { kind: 'locked_in', map: lockingIn }
    if (view.status !== 'running' && view.status !== 'paused') return null
    if (view.phase === 'paused') return { kind: 'locked', reason: 'paused', countdown, next: turn }
    if (view.stagePhase === 'lobby' || view.stagePhase === 'intro') return { kind: 'locked', reason: 'intro', countdown, next: turn }
    if (view.stagePhase === 'spotlight') return { kind: 'locked', reason: 'spotlight', countdown, next: turn }
    if (!turn) return null
    if (!actForOpen(view)) return { kind: 'waiting', turn }
    const selectedMap = actForSelectionOf(view, play)
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

function managerFinalEditorOf(view: PickBanView, play: ManagerPlay, controls: PickBanManagerControls): ManagerFinalEditor | null {
    if (!play.editing || !controls.editFinal) return null
    const editor = finalEditorOf(play.editing, view)
    return {
        ...editor,
        saving: play.submitting === 'edit-final',
        rejection: play.rejected === 'edit-final' && !editor.outdated ? play.rejection : null,
    }
}

export function managerDockOf(view: PickBanView, play: ManagerPlay): ManagerDock | null {
    const controls = view.affordances.manager
    if (!controls) return null
    const busy = play.submitting !== null
    const finalEditor = managerFinalEditorOf(view, play, controls)
    return {
        busy,
        buttons: (Object.keys(BUTTON_LABELS) as ButtonAction[])
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
        editFinal: controls.editFinal,
        finalEditor,
        confirm: play.confirming && allowed(controls, play.confirming.command)
            ? { command: play.confirming.command, ...CONFIRMATIONS[play.confirming.command] }
            : null,
        actFor: actForOf(view, play),
        rejection: play.rejected === 'lock' || (finalEditor && play.rejected === 'edit-final') ? null : play.rejection,
    }
}

function accepts(view: PickBanView, play: ManagerPlay, command: ManagerCommand): boolean {
    const controls = view.affordances.manager
    return controls !== null && play.submitting === null && allowed(controls, command)
}

function finalSaveOf(play: ManagerPlay, view: PickBanView): ManagerRequest | null {
    if (!play.editing) return null
    const { body, outdated } = finalEditorOf(play.editing, view)
    return body && !outdated ? { command: 'edit-final', body, version: play.editing.version } : null
}

function requestOf(play: ManagerPlay, view: PickBanView, action: ManagerAction): ManagerRequest | null {
    if (action.command === 'reopen') return { command: 'undo', version: view.version }
    if (action.command === 'edit-final') return finalSaveOf(play, view)
    return action
}

function submitted(play: ManagerPlay, command: ManagerCommand, request: ManagerRequest): ManagerSubmission {
    return {
        play: { ...play, submitting: command, lockingIn: null, confirming: null, rejected: null, rejection: null },
        request,
    }
}

export function beginManagerCommand(play: ManagerPlay, view: PickBanView, action: ManagerAction): ManagerSubmission | null {
    const request = accepts(view, play, action.command) ? requestOf(play, view, action) : null
    if (!request) return null
    if (needsConfirmation(action.command)) return { play: { ...play, confirming: { command: action.command, request } }, request: null }
    return submitted(play, action.command, request)
}

export function confirmManagerCommand(play: ManagerPlay, view: PickBanView): ManagerSubmission | null {
    const { confirming } = play
    return confirming && accepts(view, play, confirming.command) ? submitted(play, confirming.command, confirming.request) : null
}

export function dismissManagerConfirm(play: ManagerPlay): ManagerPlay {
    return { ...play, confirming: null }
}

function withoutFinalRejection(play: ManagerPlay): ManagerPlay {
    return play.rejected === 'edit-final' ? dismissManagerRejection(play) : play
}

export function openFinalEditor(play: ManagerPlay, view: PickBanView): ManagerPlay {
    return accepts(view, play, 'edit-final') ? withoutFinalRejection({ ...play, editing: finalDraftOf(view) }) : play
}

export function changeFinalEditor(play: ManagerPlay, change: (draft: FinalDraft) => FinalDraft): ManagerPlay {
    return play.editing ? { ...play, editing: change(play.editing) } : play
}

export function closeFinalEditor(play: ManagerPlay): ManagerPlay {
    return withoutFinalRejection({ ...play, editing: null })
}

export function settleManagerPlay(play: ManagerPlay, view: PickBanView): ManagerPlay {
    const controls = view.affordances.manager
    const applies = (command: ManagerCommand) => controls !== null && allowed(controls, command)
    const staleConfirm = play.confirming !== null && !applies(play.confirming.command)
    const staleLock = play.lockingIn !== null && play.submitting === null && optimisticLockOf(view, play) === null
    const staleEditor = play.editing !== null && !applies('edit-final')
    if (!staleConfirm && !staleLock && !staleEditor) return play
    return {
        ...play,
        confirming: staleConfirm ? null : play.confirming,
        lockingIn: staleLock ? null : play.lockingIn,
        editing: staleEditor ? null : play.editing,
    }
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
    return { ...play, submitting: null, selection: null, editing: play.submitting === 'edit-final' ? null : play.editing }
}

export function managerCommandRejected(play: ManagerPlay, error: unknown): ManagerPlay {
    return { ...play, submitting: null, lockingIn: null, rejected: play.submitting, rejection: rejectionMessage(play.submitting, error) }
}

export function dismissManagerRejection(play: ManagerPlay): ManagerPlay {
    return { ...play, rejected: null, rejection: null }
}
