import { pickBanErrorCode, type PickBanErrorCode, type PickBanParticipantCommandBodies, type PickBanStepAction } from '@/app/utils/api'
import type { PickBanCountdown, PickBanTurn, PickBanView } from './pickBanView'

export type CaptainCommand = 'ready' | 'unready' | 'lock'

interface StepChoice {
    stepIndex: number
    map: string
}

export interface CaptainPlay {
    selection: StepChoice | null
    submitting: CaptainCommand | null
    lockingIn: StepChoice | null
    rejection: string | null
}

export type CaptainControls =
    | { kind: 'ready'; ready: boolean; busy: boolean }
    | {
        kind: 'choose'
        action: PickBanStepAction
        mapNumber: number | null
        selectedMap: string | null
        canLockIn: boolean
    }
    | { kind: 'locked_in'; map: string | null }
    | { kind: 'locked'; reason: 'intro' | 'spotlight' | 'paused'; countdown: PickBanCountdown | null; next: PickBanTurn | null }
    | { kind: 'waiting'; turn: PickBanTurn }

export interface CaptainDock {
    controls: CaptainControls | null
    rejection: string | null
}

export type CaptainSubmission =
    | { play: CaptainPlay; command: 'lock'; body: Omit<PickBanParticipantCommandBodies['lock'], 'version'> }
    | { play: CaptainPlay; command: 'ready' | 'unready'; body: Omit<PickBanParticipantCommandBodies['ready'], 'version'> }

export const IDLE_CAPTAIN_PLAY: CaptainPlay = { selection: null, submitting: null, lockingIn: null, rejection: null }

type RejectionMessages = Partial<Record<PickBanErrorCode, string>>

const SESSION_REJECTIONS: RejectionMessages = {
    not_authorized: 'You no longer control your team’s choices in this pick/ban.',
    no_session: 'This match has no pick/ban session any more.',
}

const LOCK_REJECTIONS: RejectionMessages = {
    ...SESSION_REJECTIONS,
    version_conflict: 'Your lock-in didn’t count: the session changed just before it arrived. Check the board and lock in again if it’s still your turn.',
    not_your_turn: 'Your lock-in didn’t count: it isn’t your team’s turn any more.',
    map_unavailable: 'That map can’t be chosen any more. Select another.',
    spotlight_active: 'Wait for the reveal to finish, then lock in.',
    intro_active: 'Wait for the intro to finish, then lock in.',
    paused: 'The session is paused. Lock in once an admin resumes it.',
    wrong_status: 'The pick/ban isn’t running any more.',
}

const READY_REJECTIONS: RejectionMessages = {
    ...SESSION_REJECTIONS,
    version_conflict: 'The lobby changed at the same moment. Try again.',
    wrong_status: 'The pick/ban has already started, so Ready no longer applies.',
}

const UNREACHABLE = 'Couldn’t reach the server. Check your connection and try again.'

function unreachable(error: unknown): boolean {
    return error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError')
}

function rejectionMessage(command: CaptainCommand | null, error: unknown): string {
    const code = pickBanErrorCode(error)
    const messages = command === 'lock' ? LOCK_REJECTIONS : READY_REJECTIONS
    const worded = code ? messages[code] : undefined
    if (worded) return worded
    if (unreachable(error)) return UNREACHABLE
    return error instanceof Error && error.message ? error.message : 'Something went wrong. Try again.'
}

function selectedMapOf(view: PickBanView, play: CaptainPlay): string | null {
    const { turn } = view
    if (!turn || play.selection?.stepIndex !== turn.stepIndex) return null
    const map = play.selection.map
    return view.cards.some((card) => card.map === map && card.selectable) ? map : null
}

function optimisticLockOf(view: PickBanView, play: CaptainPlay): string | null {
    const { turn } = view
    if (!turn || !turn.viewerActs || turn.lockedIn || play.lockingIn?.stepIndex !== turn.stepIndex) return null
    return play.lockingIn.map
}

function withOptimisticLock(view: PickBanView, map: string): PickBanView {
    const turn = view.turn!
    return {
        ...view,
        turn: { ...turn, lockedIn: true },
        cards: view.cards.map((card) => ({ ...card, lockedIn: card.map === map, selected: false, selectable: false })),
        timeline: view.timeline.map((entry) => (entry.index === turn.stepIndex ? { ...entry, status: 'locked_in' } : entry)),
        affordances: { ...view.affordances, canLock: false },
    }
}

export function withCaptainPlay(view: PickBanView, play: CaptainPlay): PickBanView {
    const lockingIn = optimisticLockOf(view, play)
    if (lockingIn !== null) return withOptimisticLock(view, lockingIn)
    const selectedMap = selectedMapOf(view, play)
    return {
        ...view,
        cards: view.cards.map((card) => (card.map === selectedMap ? { ...card, selected: true } : card)),
    }
}

function controlsOf(view: PickBanView, play: CaptainPlay): CaptainControls | null {
    const { turn, affordances, countdown } = view
    if (affordances.actingSide === null) return null
    if (affordances.canReady) return { kind: 'ready', ready: affordances.isReady, busy: play.submitting !== null }
    if (turn?.lockedIn) return { kind: 'locked_in', map: view.cards.find((card) => card.lockedIn)?.map ?? null }
    if (view.status === 'complete') return null
    if (view.phase === 'paused') return { kind: 'locked', reason: 'paused', countdown, next: turn }
    if (view.stagePhase === 'lobby' && view.status !== 'lobby') return { kind: 'locked', reason: 'intro', countdown, next: turn }
    if (view.stagePhase === 'intro') return { kind: 'locked', reason: 'intro', countdown, next: turn }
    if (view.stagePhase === 'spotlight') return { kind: 'locked', reason: 'spotlight', countdown, next: turn }
    if (view.stagePhase !== 'awaiting' || !turn) return null
    if (!affordances.canLock) return { kind: 'waiting', turn }
    const selectedMap = selectedMapOf(view, play)
    return {
        kind: 'choose',
        action: turn.action,
        mapNumber: turn.mapNumber,
        selectedMap,
        canLockIn: selectedMap !== null && play.submitting === null,
    }
}

export function captainDockOf(view: PickBanView, play: CaptainPlay): CaptainDock | null {
    const controls = controlsOf(withCaptainPlay(view, play), play)
    if (!controls && play.rejection === null) return null
    return { controls, rejection: play.rejection }
}

export function selectMap(play: CaptainPlay, view: PickBanView, map: string): CaptainPlay {
    const played = withCaptainPlay(view, play)
    if (controlsOf(played, play)?.kind !== 'choose') return play
    if (!played.cards.some((card) => card.map === map && card.selectable)) return play
    return { ...play, selection: { stepIndex: played.turn!.stepIndex, map }, rejection: null }
}

export function beginLock(play: CaptainPlay, view: PickBanView): CaptainSubmission | null {
    const controls = captainDockOf(view, play)?.controls
    if (controls?.kind !== 'choose' || !controls.canLockIn || controls.selectedMap === null) return null
    const choice = { stepIndex: view.turn!.stepIndex, map: controls.selectedMap }
    return {
        play: { ...play, submitting: 'lock', lockingIn: choice, rejection: null },
        command: 'lock',
        body: { map: choice.map, plan_index: choice.stepIndex },
    }
}

export function beginReadyToggle(play: CaptainPlay, view: PickBanView): CaptainSubmission | null {
    const controls = captainDockOf(view, play)?.controls
    if (controls?.kind !== 'ready' || controls.busy) return null
    const command = controls.ready ? 'unready' : 'ready'
    return { play: { ...play, submitting: command, rejection: null }, command, body: {} }
}

export function commandSucceeded(play: CaptainPlay): CaptainPlay {
    return { ...play, submitting: null, lockingIn: null, selection: null }
}

export function commandRejected(play: CaptainPlay, error: unknown): CaptainPlay {
    return { ...play, submitting: null, lockingIn: null, rejection: rejectionMessage(play.submitting, error) }
}

export function dismissRejection(play: CaptainPlay): CaptainPlay {
    return play.rejection === null ? play : { ...play, rejection: null }
}
