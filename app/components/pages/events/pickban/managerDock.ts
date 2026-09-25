import {
    PICK_BAN_PRESET_IDS,
    pickBanErrorCode,
    type PickBanActor,
    type PickBanBlockingReason,
    type PickBanErrorCode,
    type PickBanManagerCommand,
    type PickBanManagerCommandBodies,
    type PickBanMember,
    type PickBanPresetId,
    type PickBanSessionStatus,
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

type PrimaryCommand = 'open' | 'start' | 'pause' | 'resume'

type HistoryCommand = 'undo' | 'reopen' | 'edit-final'

type DangerCommand = 'restart' | 'cancel'

type ButtonAction = PrimaryCommand | HistoryCommand | DangerCommand | 'swap'

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

export interface ManagerButton<C extends ButtonAction = ButtonAction> {
    command: C
    label: string
    hint: string
    disabled: boolean
}

export interface ManagerStartBlock {
    reason: string
    fix: string | null
}

export interface ManagerReadiness {
    side: PickBanSide
    ab: PickBanActor | null
    name: string
    ready: boolean
}

export interface ManagerPrimary extends ManagerButton<PrimaryCommand> {
    blocked: ManagerStartBlock | null
    readiness: ManagerReadiness[] | null
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
    stageSeed: number | null
    chosen: boolean
}

export interface ManagerHandOverMember {
    member: PickBanMember
    controls: boolean
    userId: string | null
}

export interface ManagerSideTile {
    side: PickBanSide
    ab: PickBanActor | null
    name: string
    stageSeed: number | null
    handOver: ManagerHandOverMember[] | null
}

export interface ManagerSides {
    tiles: ManagerSideTile[]
    chooseA: ManagerAChoice[] | null
    swap: ManagerButton<'swap'> | null
    basis: string | null
}

export interface ManagerSequence {
    label: string
    detail: string
    changed: boolean
    fromStageKey: string | null
    currentKeys: string[]
    changeable: boolean
}

export interface ManagerSequenceChoice {
    key: string
    label: string
    body: BodyOf<'override-sequence'>
    current: boolean
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
    submitting: ManagerCommand | null
    status: PickBanSessionStatus
    phase: string | null
    primary: ManagerPrimary | null
    done: string | null
    sides: ManagerSides | null
    sequence: ManagerSequence | null
    history: ManagerButton<HistoryCommand>[]
    danger: ManagerButton<DangerCommand>[]
    resultsWarning: string | null
    voided: Extract<PickBanBanner, { kind: 'voided' }> | null
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

const PRIMARY_COMMANDS: PrimaryCommand[] = ['open', 'start', 'pause', 'resume']

const HISTORY_COMMANDS: HistoryCommand[] = ['undo', 'reopen', 'edit-final']

const DANGER_COMMANDS: DangerCommand[] = ['restart', 'cancel']

const ACTIVE_STATUSES: PickBanSessionStatus[] = ['lobby', 'running', 'paused']

const BUTTON_LABELS: Record<ButtonAction, string> = {
    open: 'Open lobby',
    start: 'Start',
    pause: 'Pause',
    resume: 'Resume',
    swap: 'Swap A and B',
    undo: 'Undo last step',
    reopen: 'Reopen',
    'edit-final': 'Edit final maps…',
    restart: 'Restart',
    cancel: 'Cancel pick/ban',
}

const BUTTON_HINTS: Record<ButtonAction, string> = {
    open: 'Opens the lobby, so both captains can gather and ready up.',
    start: 'Plays the intro, then the first step goes on the clock. The match goes live and its predictions close.',
    pause: 'Freezes every countdown until you resume.',
    resume: 'Every countdown carries on from where it stopped.',
    swap: 'Swaps which team is A. Both Ready marks clear.',
    undo: 'Takes back the last ban or pick, with any automatic step after it.',
    reopen: 'Takes back the last ban or pick, with any automatic step after it, and runs the pick/ban again from there.',
    'edit-final': 'Rewrites the match’s maps: their order, who picked each and the decider.',
    restart: 'Undoes every step and sends both teams back to the lobby.',
    cancel: 'Ends the pick/ban for good. You can open a new lobby afterwards.',
}

const START_FIXES: Partial<Record<PickBanBlockingReason, string>> = {
    teams_not_decided: 'Both teams need to be decided in the bracket first.',
    a_undetermined: 'The stage seeds are missing or tied, so choose who is Team A under Sides.',
    pre_cup_seed_missing: 'An exclusion rule needs both teams’ pre-cup seeds. Add the missing seed, then start.',
    sequence_mismatch: 'Choose a sequence that fits the match’s best-of under Sequence.',
    pool_too_small: 'Add maps to the stage’s pool in Manage, or choose a shorter sequence under Sequence.',
}

const RESULTS_WARNING = 'Results are already entered for this match, so the pick/ban can’t start or change the maps it wrote.'

const KEEP_IT = 'Keep it'

const CONFIRMATIONS: Record<ConfirmedCommand, Omit<ManagerConfirm, 'command'>> = {
    reopen: {
        title: 'Reopen the pick/ban?',
        message: 'The last ban or pick is undone, with any automatic step after it, and the pick/ban waits on that step again. The maps it wrote into the match are removed, and any edits to the final maps are discarded.',
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

function handOverOf({ members }: PickBanTeamPanel): ManagerHandOverMember[] {
    const handedOver = members.some((member) => member.acting_captain)
    return members.map((member) => ({
        member,
        controls: handedOver ? member.acting_captain : member.captain,
        userId: member.captain ? null : member.id,
    }))
}

function buttonOf<C extends ButtonAction>(controls: PickBanManagerControls, command: C, busy: boolean): ManagerButton<C> {
    return { command, label: BUTTON_LABELS[command], hint: BUTTON_HINTS[command], disabled: busy || !allowed(controls, command) }
}

function buttonsOf<C extends ButtonAction>(controls: PickBanManagerControls, commands: C[], busy: boolean): ManagerButton<C>[] {
    return commands.filter((command) => controls[CONTROL_OF[command]]).map((command) => buttonOf(controls, command, busy))
}

function startBlockOf(code: PickBanBlockingReason | null, status: PickBanSessionStatus): ManagerStartBlock | null {
    const reason = blockingReasonLabel(code, status)
    return code === null || reason === null ? null : { reason, fix: START_FIXES[code] ?? null }
}

function primaryOf(view: PickBanView, controls: PickBanManagerControls, busy: boolean): ManagerPrimary | null {
    const command = PRIMARY_COMMANDS.find((candidate) => controls[CONTROL_OF[candidate]])
    if (!command) return null
    const starting = command === 'start'
    return {
        ...buttonOf(controls, command, busy),
        blocked: starting ? startBlockOf(controls.startBlockedBy, view.status) : null,
        readiness: starting ? panelsOf(view).map(({ side, ab, name, ready }) => ({ side, ab, name, ready: ready !== null })) : null,
    }
}

function doneOf(view: PickBanView): string | null {
    if (view.status !== 'complete') return null
    return view.edited ? 'The edited final maps are in the match.' : 'The final maps are in the match.'
}

function phaseOf(view: PickBanView): string | null {
    const stepOf = (number: number) => `Step ${number} of ${view.timeline.length}`
    switch (view.phase) {
        case 'lobby':
            return view.status === 'lobby' ? 'Waiting for Start' : 'Starting'
        case 'intro':
            return 'Intro'
        case 'awaiting':
            return view.turn && `${stepOf(view.turn.stepNumber)} · ${view.turn.actionLabel}`
        case 'spotlight':
            return view.spotlight && `${stepOf(view.spotlight.number)} · Revealing`
        case 'paused':
            return view.turn && stepOf(view.turn.stepNumber)
        case 'complete':
            return view.edited ? 'Final maps edited' : 'Final maps written'
        default:
            return null
    }
}

function seedsDecideA([first, second]: PickBanTeamPanel[]): boolean {
    return first?.stageSeed != null && second?.stageSeed != null && first.stageSeed !== second.stageSeed
}

function aBasisOf(view: PickBanView, panels: PickBanTeamPanel[]): string | null {
    if (panels.every((panel) => panel.ab === null)) return null
    return view.setup.aConfirmed ? 'A was set by a manager.' : 'A has the better stage seed.'
}

function sidesOf(view: PickBanView, controls: PickBanManagerControls, busy: boolean): ManagerSides | null {
    const panels = panelsOf(view)
    const choosing = controls.chooseA && (panels.every((panel) => panel.ab === null) || !seedsDecideA(panels))
    const swap = controls.swap && !choosing ? buttonOf(controls, 'swap', busy) : null
    if (!controls.handOver && !choosing && !swap) return null
    return {
        tiles: panels.map((panel) => ({
            side: panel.side,
            ab: panel.ab,
            name: panel.name,
            stageSeed: panel.stageSeed,
            handOver: controls.handOver ? handOverOf(panel) : null,
        })),
        chooseA: choosing ? [...panels].sort((a, b) => a.side.localeCompare(b.side)).map(({ side, name, stageSeed, ab }) => ({ side, name, stageSeed, chosen: ab === 'A' })) : null,
        swap,
        basis: aBasisOf(view, panels),
    }
}

function presetChoiceKey(id: PickBanPresetId): string {
    return `preset:${id}`
}

function stageChoiceKey(key: string): string {
    return `stage:${key}`
}

function sequenceOf(view: PickBanView, controls: PickBanManagerControls): ManagerSequence | null {
    const source = view.setup.sequence
    if (!source || !ACTIVE_STATUSES.includes(view.status)) return null
    const steps = view.timeline.length
    const bestOf = `best of ${view.match.bestOf}`
    return {
        label: source.presetId ? PICK_BAN_PRESET_LABELS[source.presetId] : 'Custom sequence',
        detail: steps > 0 ? `${steps} ${steps === 1 ? 'step' : 'steps'} · ${bestOf}` : bestOf,
        changed: !source.ownStage,
        fromStageKey: source.ownStage ? null : source.stageKey,
        currentKeys: [
            ...(source.stageKey === null ? [] : [stageChoiceKey(source.stageKey)]),
            ...(source.presetId === null ? [] : [presetChoiceKey(source.presetId)]),
        ],
        changeable: controls.overrideSequence,
    }
}

export function sequenceChoices(stages: PickBanStageConfig[], sequence: ManagerSequence | null = null): ManagerSequenceChoice[] {
    const choices = [
        ...PICK_BAN_PRESET_IDS.map((id) => ({ key: presetChoiceKey(id), label: PICK_BAN_PRESET_LABELS[id], body: { preset_id: id } })),
        ...stages
            .filter((stage) => stage.pick_ban)
            .map((stage) => ({ key: stageChoiceKey(stage.key), label: `${stage.name} (Bo${stage.best_of})`, body: { from_stage_key: stage.key } })),
    ]
    const current = sequence?.currentKeys.find((key) => choices.some((choice) => choice.key === key)) ?? null
    return choices.map((choice) => ({ ...choice, current: choice.key === current }))
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
        submitting: play.submitting,
        status: view.status,
        phase: phaseOf(view),
        primary: primaryOf(view, controls, busy),
        done: doneOf(view),
        sides: sidesOf(view, controls, busy),
        sequence: sequenceOf(view, controls),
        history: buttonsOf(controls, HISTORY_COMMANDS, busy),
        danger: buttonsOf(controls, DANGER_COMMANDS, busy),
        resultsWarning: controls.resultsPresent ? RESULTS_WARNING : null,
        voided: view.banners.find((banner) => banner.kind === 'voided') ?? null,
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
