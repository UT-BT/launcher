import {
    PICK_BAN_PRESET_IDS,
    SIDE_COLORS,
    pickBanErrorCode,
    type MatchSideSource,
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
    type SideColor,
    type VetoChoice,
} from '@/app/utils/api'
import { SIDES_TBC, sideColorName, sideColorTitle } from '@/app/utils/sideLabels'
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
import { blockingReasonLabel, sidePhaseLabel, vetoPhaseLabel } from './pickBanStatus'
import {
    actionTagOf,
    type PickBanBanner,
    type PickBanManagerControls,
    type PickBanTeamPanel,
    type PickBanUndoTarget,
    type PickBanVetoView,
    type PickBanView,
} from './pickBanView'

type ButtonCommand = 'open' | 'start' | 'swap' | 'pause' | 'resume' | 'undo' | 'restart' | 'cancel'

type WithoutVersion<B> = B extends unknown ? Omit<B, 'version'> : never

type BodyOf<C extends PickBanManagerCommand> = WithoutVersion<PickBanManagerCommandBodies[C]>

type BodyRequest =
    | { command: 'side-chooser'; body: BodyOf<'side-chooser'> }
    | { command: 'sides'; body: BodyOf<'sides'> }
    | { command: 'side'; body: BodyOf<'side'> }
    | { command: 'veto'; body: BodyOf<'veto'> }
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

type BodyConfirmedCommand = 'side' | 'veto'

type ConfirmedCommand = 'reopen' | 'restart' | 'cancel' | 'edit-final' | BodyConfirmedCommand

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
    destructive: boolean
}

export interface ManagerTeamChoice {
    side: PickBanSide
    name: string
    chosen: boolean
}

export interface ManagerChooserChoice extends ManagerTeamChoice {
    preCupSeed: number | null
}

export interface ManagerChooser {
    undetermined: boolean
    choices: ManagerChooserChoice[]
    disabled: boolean
}

export interface ManagerSetSides {
    choices: ManagerTeamChoice[]
    hint: string
    disabled: boolean
    reason: string | null
}

export interface ManagerSideOption {
    color: SideColor
    title: string
    lead: string
}

export interface ManagerStepZero {
    side: PickBanSide
    teamName: string
    options: ManagerSideOption[]
    disabled: boolean
}

export interface ManagerSourceBadge {
    source: MatchSideSource | null
    label: string
    hint: string
}

export interface ManagerHandOverMember {
    member: PickBanMember
    controls: boolean
    userId: string | null
}

export interface ManagerSideTile {
    side: PickBanSide
    ab: PickBanActor | null
    color: SideColor
    name: string
    handOver: ManagerHandOverMember[] | null
}

export interface ManagerSides {
    tiles: ManagerSideTile[]
    confirmed: boolean
    badge: ManagerSourceBadge
    basis: string | null
    chooser: ManagerChooser | null
    setSides: ManagerSetSides | null
    swap: ManagerButton<'swap'> | null
    stepZero: ManagerStepZero | null
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

export type ManagerVetoTeamState = 'deciding' | VetoChoice

export interface ManagerVetoTeam {
    side: PickBanSide
    name: string
    state: ManagerVetoTeamState
    label: string
}

export interface ManagerVetoOption {
    choice: VetoChoice
    label: string
    lead: string
}

export interface ManagerVetoActFor {
    side: PickBanSide
    ab: PickBanActor | null
    teamName: string
    options: ManagerVetoOption[]
    disabled: boolean
}

export interface ManagerVeto {
    lobbyLine: string | null
    teams: ManagerVetoTeam[]
    outcome: string | null
    actFor: ManagerVetoActFor[]
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
    veto: ManagerVeto | null
    history: ManagerButton<HistoryCommand>[]
    danger: ManagerButton<DangerCommand>[]
    resultsWarning: string | null
    voided: Extract<PickBanBanner, { kind: 'voided' }> | null
    finalEditor: ManagerFinalEditor | null
    confirm: ManagerConfirm | null
    actFor: ManagerActFor | null
    playingNote: string | null
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

const CONTROL_OF: Record<Exclude<ManagerCommand, 'lock' | 'veto'>, keyof PickBanManagerControls> = {
    open: 'open',
    start: 'start',
    'side-chooser': 'sideChooser',
    sides: 'setSides',
    side: 'actForSideChoice',
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

const UNDO_LABELS: Record<PickBanUndoTarget, string> = {
    step: 'Undo Last Step',
    side: 'Undo Side Choice',
    veto: 'Undo Veto',
}

const UNDO_HINTS: Record<PickBanUndoTarget, string> = {
    step: 'Takes back the last pick or ban, with any automatic step after it.',
    side: 'Takes back the side choice, so the team chooses again.',
    veto: 'Takes back the veto, so the eligible teams choose again.',
}

const BUTTON_LABELS: Record<ButtonAction, string> = {
    open: 'Open Lobby',
    start: 'Start',
    pause: 'Pause',
    resume: 'Resume',
    swap: 'Swap Red and Blue',
    undo: UNDO_LABELS.step,
    reopen: 'Reopen',
    'edit-final': 'Edit Final Maps…',
    restart: 'Restart',
    cancel: 'Cancel Picks & Bans',
}

const BUTTON_HINTS: Record<ButtonAction, string> = {
    open: 'Opens the lobby, so both captains can gather and ready up.',
    start: 'Starts the Picks & Bans process. The match goes live and its predictions close.',
    pause: 'Freezes every countdown until you resume.',
    resume: 'Every countdown carries on from where it stopped.',
    swap: 'Swaps Red and Blue, so the other team is Side A and acts first.',
    undo: UNDO_HINTS.step,
    reopen: 'Takes back the last pick or ban, with any automatic step after it, and continues the Picks & Bans process from there.',
    'edit-final': 'Rewrites the match’s maps: their order, who picked each and the decider.',
    restart: 'Undoes every step and sends both teams back to the lobby.',
    cancel: 'Ends the Picks & Bans process for good. You can open a new lobby afterwards from Match Control.',
}

const START_FIXES: Partial<Record<PickBanBlockingReason, string>> = {
    teams_not_decided: 'Both teams need to be decided in the bracket first.',
    side_chooser_undetermined: 'The seeds can’t decide which team chooses Red or Blue, so name it under Chooser, or set the sides yourself.',
    pre_cup_seed_missing: 'An exclusion rule needs both teams’ pre-cup seeds. Add the missing seed, then start.',
    sequence_mismatch: 'Choose a sequence that fits the match’s best-of under Sequence.',
    pool_too_small: 'Add maps to the stage’s pool in Manage, or choose a shorter sequence under Sequence.',
}

const RESULTS_WARNING = 'Results are already entered for this match, so the Picks & Bans process can’t start or change the maps it wrote.'

const KEEP_IT = 'Keep It'

const CONFIRMATIONS: Record<Exclude<ConfirmedCommand, BodyConfirmedCommand>, Omit<ManagerConfirm, 'command'>> = {
    reopen: {
        title: 'Reopen the Picks & Bans process?',
        message: 'The last pick or ban is undone, with any automatic step after it, and the Picks & Bans process waits on that step again. The maps it wrote into the match are removed, and any edits to the final maps are discarded.',
        confirmLabel: BUTTON_LABELS.reopen,
        dismissLabel: KEEP_IT,
        destructive: true,
    },
    restart: {
        title: 'Restart the Picks & Bans process?',
        message: 'Every pick and ban so far is undone and both teams go back to the lobby. Both Ready marks clear, and any maps this Picks & Bans process wrote into the match are removed.',
        confirmLabel: BUTTON_LABELS.restart,
        dismissLabel: KEEP_IT,
        destructive: true,
    },
    cancel: {
        title: 'Cancel the Picks & Bans process?',
        message: 'This ends the Picks & Bans process for good. Its picks and bans won’t count, and any maps it wrote into the match are removed. You can open a new lobby afterwards.',
        confirmLabel: BUTTON_LABELS.cancel,
        dismissLabel: KEEP_IT,
        destructive: true,
    },
    'edit-final': {
        title: 'Save the edited final maps?',
        message: 'The match’s maps are rewritten to your list, in its order, with the picks and decider you set. The final summary is marked Edited, and the timeline keeps the picks and bans as they were played.',
        confirmLabel: 'Save Final Maps',
        dismissLabel: 'Keep Editing',
        destructive: false,
    },
}

const SOURCE_BADGES: Record<MatchSideSource, Omit<ManagerSourceBadge, 'source'>> = {
    step0: { label: 'Step 0', hint: 'Chosen by a team at step 0.' },
    admin: { label: 'Admin', hint: 'Set by an admin.' },
    caster: { label: 'Caster', hint: 'Set by the caster.' },
    backfill: { label: 'Backfill', hint: 'Carried over from before sides were recorded.' },
}

const TBC_BADGE: ManagerSourceBadge = {
    source: null,
    label: SIDES_TBC,
    hint: 'Nobody has set the sides yet, so Red is the bracket’s first team for now.',
}

const SIDES_SET_BASIS = 'The sides are set, so step 0 is skipped.'

const SET_SIDES_HINTS = {
    lobby: 'Setting the sides skips step 0.',
    running: 'Step 1 follows the new colours.',
}

const SET_SIDES_AFTER_STEP_ONE = 'Step 1 is in, so change the sides in the match editor instead.'

const SET_SIDES_PAUSED = 'Resume the Picks & Bans process to set the sides.'

const SWAP_TBC = 'Set the sides first: there’s nothing to swap while they’re TBC.'

const SIDE_OPTION_FALLBACK_LEADS: Record<SideColor, string> = { red: 'Acts first', blue: 'Acts second' }

const PLAYING_NOTE = 'You play in this match, so you can’t lock in on a team’s behalf. An admin who isn’t playing has to do that.'

const VETO_TEAM_LABELS: Record<ManagerVetoTeamState, string> = {
    deciding: 'Deciding',
    veto: 'Veto',
    play: 'Play',
}

const REJECTIONS: Record<Exclude<PickBanErrorCode, PickBanBlockingReason>, string> = {
    not_authorized: 'You can’t manage this Picks & Bans process any more.',
    not_your_turn: 'That team isn’t choosing any more.',
    plays_in_match: PLAYING_NOTE,
    session_exists: 'This match already has a Picks & Bans process open.',
    intro_active: 'Wait for the intro to finish, then lock in.',
    spotlight_active: 'Wait for the reveal to finish, then lock in.',
    paused: 'The Picks & Bans process is paused. Resume it first.',
    map_unavailable: 'That map can’t be chosen any more. Select another.',
    version_conflict: 'The session changed just before your click. Check it and try again.',
    invalid_request: 'The server didn’t accept that request. Refresh the page and try again.',
    no_session: 'This match has no Picks & Bans session any more.',
    match_live: 'The match is already live, so a lobby can’t open.',
    wrong_status: 'The session moved on just before your click, so that no longer applies.',
    nothing_to_undo: 'There’s no pick or ban to undo.',
    side_choice_active: 'Wait for the side choice to finish, then lock in.',
    side_not_open: 'The sides can’t change at this point any more.',
    veto_not_open: 'The veto isn’t open any more. Check the session and try again.',
    already_chosen: 'That team has already chosen.',
    veto_choice_active: 'Wait for the veto to finish, then lock in.',
}

const COMMAND_REJECTIONS: Partial<Record<ManagerCommand, Partial<Record<PickBanErrorCode, (detail: string) => string>>>> = {
    'hand-over': {
        invalid_request: () => 'That player can’t take control: pick an active roster member of that side’s team.',
    },
    'edit-final': {
        invalid_request: (detail) => `The server didn’t accept that final list. ${detail}`,
        version_conflict: () => 'The final maps changed since you opened the editor.',
    },
    side: {
        side_not_open: () => 'Step 0 is over, so the side can’t be chosen any more.',
    },
    sides: {
        side_not_open: () => SET_SIDES_AFTER_STEP_ONE,
    },
    'side-chooser': {
        side_not_open: () => 'The lobby has closed, so the chooser can’t change any more.',
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
    return command === 'side' || command === 'veto' || command in CONFIRMATIONS
}

function allowed(controls: PickBanManagerControls, command: ManagerCommand): boolean {
    if (command === 'lock') return false
    if (command === 'veto') return controls.actForVeto.length > 0
    if (command === 'start' && controls.startBlockedBy !== null) return false
    return Boolean(controls[CONTROL_OF[command]])
}

function allowedRequest(controls: PickBanManagerControls, request: ManagerAction | ManagerRequest): boolean {
    if (request.command === 'veto') return controls.actForVeto.includes(request.body.side)
    return allowed(controls, request.command)
}

function allowedConfirmation(controls: PickBanManagerControls, { command, request }: PendingConfirmation): boolean {
    return request.command === 'veto' ? allowedRequest(controls, request) : allowed(controls, command)
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
    const undoing = command === 'undo' ? controls.undoTarget : null
    return {
        command,
        label: undoing ? UNDO_LABELS[undoing] : BUTTON_LABELS[command],
        hint: undoing ? UNDO_HINTS[undoing] : BUTTON_HINTS[command],
        disabled: busy || !allowed(controls, command),
    }
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
    if (view.side.phase && view.status === 'running') return sidePhaseLabel(view.side.phase)
    if (view.veto?.phase && view.status === 'running') return vetoPhaseLabel(view.veto.phase)
    switch (view.phase) {
        case 'lobby':
            return view.status === 'lobby' ? 'Waiting for Start' : 'Starting'
        case 'intro':
            return 'Intro'
        case 'awaiting':
            if (!view.turn) return null
            return view.affordances.manager?.lockForSide ? `${stepOf(view.turn.stepNumber)} · ${actionTagOf(view.turn)}` : stepOf(view.turn.stepNumber)
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

function bySide(panels: PickBanTeamPanel[]): PickBanTeamPanel[] {
    return [...panels].sort((a, b) => a.side.localeCompare(b.side))
}

function badgeOf({ side }: PickBanView): ManagerSourceBadge {
    return side.confirmed && side.source !== null ? { source: side.source, ...SOURCE_BADGES[side.source] } : TBC_BADGE
}

function basisOf({ side, status }: PickBanView): string | null {
    if (status === 'lobby' && side.confirmed && side.source === 'admin') return SIDES_SET_BASIS
    if (status !== 'lobby' && side.confirmed) return null
    return side.chooserLine
}

function chooserOf(view: PickBanView, panels: PickBanTeamPanel[], controls: PickBanManagerControls, busy: boolean): ManagerChooser | null {
    if (!controls.sideChooser) return null
    return {
        undetermined: view.side.chooser === null,
        choices: bySide(panels).map(({ side, name, preCupSeed }) => ({ side, name, preCupSeed, chosen: side === view.side.chooser })),
        disabled: busy,
    }
}

function setSidesReasonOf(view: PickBanView, controls: PickBanManagerControls): string | null {
    if (controls.setSides) return null
    const stepOneIn = controls.undo || view.timeline.some((entry) => entry.map !== null)
    return view.status === 'paused' && !stepOneIn ? SET_SIDES_PAUSED : SET_SIDES_AFTER_STEP_ONE
}

function setSidesOf(view: PickBanView, panels: PickBanTeamPanel[], controls: PickBanManagerControls, busy: boolean): ManagerSetSides {
    return {
        choices: bySide(panels).map(({ side, name }) => ({ side, name, chosen: view.side.confirmed && side === view.side.red })),
        hint: view.status === 'lobby' ? SET_SIDES_HINTS.lobby : SET_SIDES_HINTS.running,
        disabled: busy || !controls.setSides,
        reason: setSidesReasonOf(view, controls),
    }
}

function swapOf(controls: PickBanManagerControls, busy: boolean): ManagerButton<'swap'> | null {
    if (!controls.setSides) return null
    const button = buttonOf(controls, 'swap', busy)
    return controls.swap ? button : { ...button, hint: SWAP_TBC }
}

function sideOptionOf(view: PickBanView, color: SideColor): ManagerSideOption {
    const card = view.side.cards.find((candidate) => candidate.color === color)
    return { color, title: sideColorTitle(color), lead: card?.lead ?? SIDE_OPTION_FALLBACK_LEADS[color] }
}

function stepZeroOf(view: PickBanView, controls: PickBanManagerControls, busy: boolean): ManagerStepZero | null {
    const side = controls.actForSideChoice
    if (side === null) return null
    return { side, teamName: view.side.chooserName ?? 'TBD', options: SIDE_COLORS.map((color) => sideOptionOf(view, color)), disabled: busy }
}

function sidesOf(view: PickBanView, controls: PickBanManagerControls, busy: boolean): ManagerSides | null {
    if (!controls.handOver) return null
    const panels = panelsOf(view)
    return {
        tiles: panels.map((panel) => ({
            side: panel.side,
            ab: panel.ab,
            color: panel.color,
            name: panel.name,
            handOver: handOverOf(panel),
        })),
        confirmed: view.side.confirmed,
        badge: badgeOf(view),
        basis: basisOf(view),
        chooser: chooserOf(view, panels, controls, busy),
        setSides: setSidesOf(view, panels, controls, busy),
        swap: swapOf(controls, busy),
        stepZero: stepZeroOf(view, controls, busy),
    }
}

function lowerFirst(text: string): string {
    return text.charAt(0).toLowerCase() + text.slice(1)
}

function vetoLobbyLineOf({ tag, active, eligibleNames }: PickBanVetoView): string {
    if (!active) return 'No veto: neither team eligible'
    return `${tag}-map veto: ${eligibleNames.length > 1 ? 'both teams' : eligibleNames[0]} eligible`
}

function vetoOutcomeOf(veto: PickBanVetoView): string | null {
    if (!veto.active || veto.outcome === null) return null
    const mapCount = veto.outcome === 'vetoed' ? veto.poolSizes.vetoed : veto.poolSizes.played
    const what = veto.outcome === 'vetoed' ? `${veto.vetoedByName ?? 'A team'} vetoed the ${veto.tag} maps` : `${veto.tag} maps stay in`
    return `${what} · ${mapCount} maps`
}

function vetoTeamOf(side: PickBanSide, name: string, choice: VetoChoice | null): ManagerVetoTeam {
    const state = choice ?? 'deciding'
    return { side, name, state, label: VETO_TEAM_LABELS[state] }
}

function vetoOptionsOf(veto: PickBanVetoView): ManagerVetoOption[] {
    return [
        { choice: 'veto', label: `Veto ${veto.tag} maps`, lead: `Play ${veto.poolSizes.vetoed} maps` },
        { choice: 'play', label: `Play ${veto.tag} maps`, lead: `Play ${veto.poolSizes.played} maps` },
    ]
}

function vetoTeamNameOf(veto: PickBanVetoView, side: PickBanSide): string | null {
    return veto.choices.find((entry) => entry.side === side)?.teamName ?? null
}

function vetoActForOf(view: PickBanView, veto: PickBanVetoView, controls: PickBanManagerControls, busy: boolean): ManagerVetoActFor[] {
    return controls.actForVeto.map((side) => ({
        side,
        ab: panelsOf(view).find((panel) => panel.side === side)?.ab ?? null,
        teamName: vetoTeamNameOf(veto, side) ?? 'TBD',
        options: vetoOptionsOf(veto),
        disabled: busy,
    }))
}

function vetoOf(view: PickBanView, controls: PickBanManagerControls, busy: boolean): ManagerVeto | null {
    const { veto } = view
    if (!veto) return null
    const lobby = view.status === 'lobby'
    const shown = {
        lobbyLine: lobby ? vetoLobbyLineOf(veto) : null,
        teams: veto.active && !lobby ? veto.choices.map(({ side, teamName, choice }) => vetoTeamOf(side, teamName, choice)) : [],
        outcome: vetoOutcomeOf(veto),
        actFor: vetoActForOf(view, veto, controls, busy),
    }
    return shown.lobbyLine === null && shown.teams.length === 0 && shown.outcome === null && shown.actFor.length === 0 ? null : shown
}

function vetoConfirmOf(view: PickBanView, { side, choice }: BodyOf<'veto'>): ManagerConfirm {
    const tag = view.veto?.tag ?? 'Hard'
    const team = (view.veto && vetoTeamNameOf(view.veto, side)) ?? 'The team'
    const vetoing = choice === 'veto'
    return {
        command: 'veto',
        title: `${vetoing ? 'Veto' : 'Play'} the ${tag} maps for ${team}?`,
        message: vetoing
            ? `${team} veto the ${tag} maps. One veto is enough: the ${tag} maps are removed and ${view.veto?.poolSizes.vetoed ?? 0} maps are played.`
            : `${team} play the ${tag} maps. They stay in unless another eligible team vetoes them.`,
        confirmLabel: `${vetoing ? 'Veto' : 'Play'} ${tag} Maps`,
        dismissLabel: 'Go Back',
        destructive: false,
    }
}

function sideConfirmOf(view: PickBanView, choice: SideColor): ManagerConfirm {
    const option = sideOptionOf(view, choice)
    const team = view.side.chooserName ?? 'The team'
    const colour = sideColorName(choice)
    return {
        command: 'side',
        title: `Lock in ${colour} for ${team}?`,
        message: `${team} become ${option.title}: ${lowerFirst(option.lead)}. The reveal plays, then step 1 opens.`,
        confirmLabel: `Lock In ${colour}`,
        dismissLabel: 'Go Back',
        destructive: false,
    }
}

function confirmOf(view: PickBanView, { command, request }: PendingConfirmation): ManagerConfirm {
    if (command === 'side' && request.command === 'side') return sideConfirmOf(view, request.body.choice)
    if (command === 'veto' && request.command === 'veto') return vetoConfirmOf(view, request.body)
    return { command, ...CONFIRMATIONS[command as Exclude<ConfirmedCommand, BodyConfirmedCommand>] }
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
    if (!view.affordances.manager?.lockForSide) return null
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
    const actFor = actForOf(view, play)
    return {
        busy,
        submitting: play.submitting,
        status: view.status,
        phase: phaseOf(view),
        primary: primaryOf(view, controls, busy),
        done: doneOf(view),
        sides: sidesOf(view, controls, busy),
        sequence: sequenceOf(view, controls),
        veto: vetoOf(view, controls, busy),
        history: buttonsOf(controls, HISTORY_COMMANDS, busy),
        danger: buttonsOf(controls, DANGER_COMMANDS, busy),
        resultsWarning: controls.resultsPresent ? RESULTS_WARNING : null,
        voided: view.banners.find((banner) => banner.kind === 'voided') ?? null,
        finalEditor,
        confirm: play.confirming && allowedConfirmation(controls, play.confirming) ? confirmOf(view, play.confirming) : null,
        actFor,
        playingNote: !controls.lockForSide && (view.status === 'running' || view.status === 'paused') ? PLAYING_NOTE : null,
        rejection: (actFor && play.rejected === 'lock') || (finalEditor && play.rejected === 'edit-final') ? null : play.rejection,
    }
}

function accepts(view: PickBanView, play: ManagerPlay, request: ManagerAction | ManagerRequest): boolean {
    const controls = view.affordances.manager
    return controls !== null && play.submitting === null && allowedRequest(controls, request)
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
    const request = accepts(view, play, action) ? requestOf(play, view, action) : null
    if (!request) return null
    if (needsConfirmation(action.command)) return { play: { ...play, confirming: { command: action.command, request } }, request: null }
    return submitted(play, action.command, request)
}

export function confirmManagerCommand(play: ManagerPlay, view: PickBanView): ManagerSubmission | null {
    const { confirming } = play
    const controls = view.affordances.manager
    if (!confirming || controls === null || play.submitting !== null || !allowedConfirmation(controls, confirming)) return null
    return submitted(play, confirming.command, confirming.request)
}

export function dismissManagerConfirm(play: ManagerPlay): ManagerPlay {
    return { ...play, confirming: null }
}

function withoutFinalRejection(play: ManagerPlay): ManagerPlay {
    return play.rejected === 'edit-final' ? dismissManagerRejection(play) : play
}

export function openFinalEditor(play: ManagerPlay, view: PickBanView): ManagerPlay {
    return accepts(view, play, { command: 'edit-final' }) ? withoutFinalRejection({ ...play, editing: finalDraftOf(view) }) : play
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
    const staleConfirm = play.confirming !== null && (controls === null || !allowedConfirmation(controls, play.confirming))
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
