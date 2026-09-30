import { useId, useRef, useState } from 'react'
import { AlertTriangle, Play, RotateCw, Settings, Square } from 'lucide-react'
import type { CamRequest } from '@/lib/conveyor/schemas/stream-kit-schema'
import { CAM_FPS_OPTIONS, type CamFps, type CamSlot, type CamTeam } from '@/lib/stream-kit/cam-plan'
import { useNavState } from '@/app/components/navigation/useNavState'
import { PICK_BAN_TONES } from '@/app/components/broadcast/broadcastTone'
import { CHIP_SHAPE } from '@/app/components/shared/chipStyles'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import type { Server } from '@/app/utils/server-utils'
import { cn } from '@/lib/utils'
import { StreamCard, StreamLoading } from '../StreamCard'
import { UncertifiedServerWarning } from '../UncertifiedServerWarning'
import { useStreamTab } from '../StreamTabContext'
import { useCamFps, useCamStatus, useInstallPath, useServerList } from './cams/camToolHooks'
import {
    CAM_TEAMS,
    DETECTED_CHOICES,
    buildCamToolView,
    camErrorMessages,
    serverAddressOf,
    type CamServerChoice,
    type CamServerChoices,
    type CamStatusView,
    type CamTeamServerView,
    type CamToolError,
} from './cams/camToolView'

const ACTION_SHAPE = 'h-8 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer inline-flex items-center gap-2 disabled:cursor-default disabled:opacity-50'
const ACCENT_ACTION = 'bg-accent-500/15 border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:border-accent-500/60'
const MUTED_ACTION = 'bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20'
const DANGER_ACTION = 'bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/25 hover:text-red-200 hover:border-red-500/50'
const FIELD = 'h-9 w-full min-w-0 rounded-lg border border-hairline/10 bg-card/40 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-accent-500/60 disabled:opacity-60'
const GOOD_CHIP = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
const WARN_CHIP = 'bg-amber-500/10 border-amber-500/30 text-amber-300'
const IDLE_CHIP = 'bg-card/50 border-hairline/10 text-muted-foreground'
const TYPED_VALUE = 'typed'
const DETECTED_VALUE = 'detected'
const LIST_PREFIX = 'list:'

interface StoredChoices {
    matchId: string | null
    choices: CamServerChoices
}

const NO_STORED_CHOICES: StoredChoices = { matchId: null, choices: DETECTED_CHOICES }

type CamAction = () => Promise<{ ok: true } | { ok: false; errors: CamToolError[] } | void>

function Chip({ className, children }: { className: string; children: string }) {
    return <span className={cn(CHIP_SHAPE, className)}>{children}</span>
}

function openInstallSettings() {
    window.dispatchEvent(new CustomEvent('open-settings', { detail: { section: 'game-installation' } }))
}

function teamTone(team: CamTeam) {
    return PICK_BAN_TONES[team === 'A' ? 'a' : 'b']
}

function choiceValue(choice: CamServerChoice): string {
    if (choice.mode === 'list') return `${LIST_PREFIX}${choice.address}`
    return choice.mode === 'typed' ? TYPED_VALUE : DETECTED_VALUE
}

function serverOptionLabel(server: Server): string {
    const players = server.players.filter(player => !player.is_spectator).length
    return `${server.hostname || serverAddressOf(server)} · ${players} playing`
}

function detectionText(view: CamTeamServerView): string {
    if (view.detected) {
        const { found, rosterSize, serverName } = view.detected
        return `${found} of ${rosterSize} ${view.teamName} player${rosterSize === 1 ? '' : 's'} found on ${serverName}.`
    }
    if (view.problem === 'loading') return 'Checking the server list…'
    return `No ${view.teamName} player is on a listed server right now.`
}

function TeamServerPicker({
    view,
    servers,
    onChange,
    disabled,
}: {
    view: CamTeamServerView
    servers: readonly Server[] | null
    onChange: (choice: CamServerChoice) => void
    disabled: boolean
}) {
    const selectId = useId()
    const typedId = useId()
    const tone = teamTone(view.team)
    const choice = view.choice
    const pickedMissing = choice.mode === 'list' && !servers?.some(server => serverAddressOf(server) === choice.address)

    function select(value: string) {
        if (value === DETECTED_VALUE) onChange({ mode: 'detected' })
        else if (value === TYPED_VALUE) onChange({ mode: 'typed', address: view.address ?? '' })
        else onChange({ mode: 'list', address: value.slice(LIST_PREFIX.length) })
    }

    return (
        <div data-testid={`cam-team-${view.team}`} className={cn('min-w-0 space-y-2 rounded-lg border bg-card/40 p-3', tone.line)}>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className={cn(CHIP_SHAPE, tone.soft, tone.line, tone.text)}>Team {view.team}</span>
                <span className="min-w-0 break-words text-sm font-semibold text-foreground">{view.teamName}</span>
            </div>
            <label htmlFor={selectId} className="block text-[10px] uppercase tracking-wider text-muted-foreground">Server</label>
            <select
                id={selectId}
                value={choiceValue(choice)}
                disabled={disabled}
                onChange={event => select(event.target.value)}
                style={{ colorScheme: 'dark' }}
                className={FIELD}
            >
                <option value={DETECTED_VALUE}>
                    {view.detected ? `Detected: ${view.detected.serverName}` : 'Detected: none yet'}
                </option>
                {pickedMissing && choice.mode === 'list' && (
                    <option value={choiceValue(choice)}>{choice.address} (no longer listed)</option>
                )}
                {(servers ?? []).map(server => (
                    <option key={server.id} value={`${LIST_PREFIX}${serverAddressOf(server)}`}>{serverOptionLabel(server)}</option>
                ))}
                <option value={TYPED_VALUE}>Type an address…</option>
            </select>
            {choice.mode === 'typed' && (
                <div className="space-y-1">
                    <label htmlFor={typedId} className="sr-only">{view.teamName} server address</label>
                    <input
                        id={typedId}
                        type="text"
                        value={choice.address}
                        disabled={disabled}
                        onChange={event => onChange({ mode: 'typed', address: event.target.value })}
                        placeholder="host:port"
                        spellCheck={false}
                        autoComplete="off"
                        aria-invalid={view.problem === 'invalid-address'}
                        className={cn(FIELD, 'font-mono', view.problem === 'invalid-address' && 'border-red-500/50')}
                    />
                </div>
            )}
            <p className="text-xs text-muted-foreground break-words">{detectionText(view)}</p>
            {view.uncertified && <UncertifiedServerWarning testId={`cam-team-${view.team}-uncertified`} />}
            <p className="text-xs text-foreground break-all">
                <span className="text-muted-foreground">Cams join </span>
                <span data-testid={`cam-team-${view.team}-address`} className="font-mono">{view.address ?? '—'}</span>
                {view.serverName && view.source !== 'detected' && <span className="text-muted-foreground"> · {view.serverName}</span>}
            </p>
        </div>
    )
}

function FpsPicker({
    fps,
    onChoose,
    saveFailed,
    disabled,
}: {
    fps: CamFps | undefined
    onChoose: (fps: CamFps) => void
    saveFailed: boolean
    disabled: boolean
}) {
    const labelId = useId()

    return (
        <div className="space-y-2">
            <h3 id={labelId} className="text-[10px] uppercase tracking-wider text-muted-foreground">Cam FPS</h3>
            <div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center gap-2">
                {CAM_FPS_OPTIONS.map(option => (
                    <button
                        key={option}
                        type="button"
                        disabled={disabled || fps === undefined}
                        aria-pressed={fps === option}
                        onClick={() => onChoose(option)}
                        className={cn(ACTION_SHAPE, fps === option ? ACCENT_ACTION : MUTED_ACTION)}
                    >
                        {option}
                    </button>
                ))}
            </div>
            <p className="text-xs text-muted-foreground break-words">
                120 keeps the cams smooth on a 60 fps stream. Pick 60 if your PC struggles to run four cams. It applies the next time the cams launch or restart.
            </p>
            {saveFailed && <p role="alert" className="text-xs text-amber-300 break-words">Could not save the frame rate, so it resets when the launcher restarts.</p>}
        </div>
    )
}

function statusChips(cam: CamStatusView) {
    if (!cam.running) return <Chip className={IDLE_CHIP}>Stopped</Chip>
    return (
        <>
            <Chip className={GOOD_CHIP}>Running</Chip>
            <Chip className={cam.titled ? GOOD_CHIP : WARN_CHIP}>{cam.titled ? 'Titled' : 'Not titled yet'}</Chip>
            {cam.stale && <Chip className={WARN_CHIP}>Wrong player</Chip>}
        </>
    )
}

function CamRow({
    cam,
    onRestart,
    disabled,
}: {
    cam: CamStatusView
    onRestart: (slot: CamSlot) => void
    disabled: boolean
}) {
    const { lineup } = cam
    const tone = teamTone(lineup.team)

    return (
        <li
            data-testid={`cam-${cam.slot}`}
            className={cn('min-w-0 space-y-2 rounded-lg border bg-card/40 p-3', cam.stale ? 'border-amber-500/40' : 'border-hairline/10')}
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className={cn(CHIP_SHAPE, tone.soft, tone.line, tone.text)}>{cam.slot}</span>
                    <span className="font-mono text-xs text-foreground">{cam.windowTitle}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">{statusChips(cam)}</div>
            </div>

            <dl className="grid min-w-0 gap-x-3 gap-y-1 text-xs sm:grid-cols-[auto_minmax(0,1fr)]">
                <dt className="text-muted-foreground">Lineup</dt>
                <dd className="min-w-0">
                    {lineup.person ? (
                        <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
                            <PlayerInfo userId={lineup.person.id} alias={lineup.person.display_name} size="sm" interactive={false} />
                            {lineup.problem === 'unlinked' && <span className="text-amber-300">No linked Discord account</span>}
                        </span>
                    ) : (
                        <span className="text-amber-300">Empty</span>
                    )}
                </dd>
                <dt className="text-muted-foreground">Following</dt>
                <dd className="min-w-0" data-testid={`cam-${cam.slot}-target`}>
                    {cam.running && cam.target ? (
                        <PlayerInfo userId={cam.target.discordId} alias={cam.target.name ?? cam.target.discordId} size="sm" interactive={false} />
                    ) : (
                        <span className="text-muted-foreground">—</span>
                    )}
                </dd>
                <dt className="text-muted-foreground">Server</dt>
                <dd className="min-w-0 break-all" data-testid={`cam-${cam.slot}-server`}>
                    {cam.server ? (
                        <>
                            <span className="font-mono text-foreground">{cam.server}</span>
                            {cam.serverName && <span className="text-muted-foreground"> · {cam.serverName}</span>}
                            {cam.movedServer && <span className="text-muted-foreground"> (followed its player here)</span>}
                        </>
                    ) : (
                        <span className="text-muted-foreground">{cam.running ? 'Connecting…' : '—'}</span>
                    )}
                </dd>
            </dl>

            {cam.staleMessage && <p role="status" className="text-xs text-amber-300 break-words">{cam.staleMessage}</p>}
            {cam.exitNote && <p className="text-xs text-red-300 break-words">{cam.exitNote}</p>}

            {cam.target && (
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onRestart(cam.slot)}
                    className={cn(ACTION_SHAPE, cam.stale ? ACCENT_ACTION : MUTED_ACTION)}
                >
                    <RotateCw className="size-3.5" aria-hidden="true" /> Restart {cam.slot}
                </button>
            )}
        </li>
    )
}

export function CamTool() {
    const { desk, deskLoading, deskError } = useStreamTab()
    const installPath = useInstallPath()
    const { servers, failed: serversFailed } = useServerList()
    const { status, setStatus, read } = useCamStatus()
    const { fps, choose: chooseFps, saveFailed: fpsSaveFailed } = useCamFps()
    const [stored, setStored] = useNavState<StoredChoices>('event.camServers', NO_STORED_CHOICES)
    const busy = useRef(false)
    const [pending, setPending] = useState(false)
    const [errors, setErrors] = useState<string[]>([])

    const matchId = desk?.match?.id ?? null
    const choices = stored.matchId === matchId ? stored.choices : DETECTED_CHOICES
    const view = buildCamToolView({ desk, servers, choices, installPath, status, fps })

    function changeChoice(team: CamTeam, choice: CamServerChoice) {
        setStored({ matchId, choices: { ...choices, [team]: choice } })
    }

    async function run(action: CamAction) {
        if (busy.current) return
        busy.current = true
        setPending(true)
        setErrors([])
        try {
            const result = await action()
            if (result && !result.ok) setErrors(camErrorMessages(result.errors))
        } catch (error) {
            setErrors([error instanceof Error && error.message ? error.message : 'The cam tool failed.'])
        } finally {
            await read()
            busy.current = false
            setPending(false)
        }
    }

    const launch = (request: CamRequest) => run(async () => {
        const plan = await window.conveyor.streamKit.planCams(request)
        if (!plan.ok) return plan
        const result = await window.conveyor.streamKit.launchCams(request)
        if (result.ok) setStatus(result.status)
        return result
    })

    const restart = (slot: CamSlot) => run(async () => {
        const result = await window.conveyor.streamKit.restartCam(slot, view.launch.request)
        if (result.ok) setStatus(result.status)
        return result
    })

    const stopAll = () => run(async () => {
        setStatus(await window.conveyor.streamKit.stopCams())
    })

    if (!desk) {
        return (
            <StreamCard title="Cams" description="Four spectator cams for the current match, one per player.">
                {deskLoading || !deskError
                    ? <StreamLoading label="the current match" />
                    : <p role="alert" className="text-xs text-red-300">The current match could not be loaded.</p>}
            </StreamCard>
        )
    }

    const request = view.launch.request
    const launchBlockers = view.launch.blockers

    return (
        <div className="space-y-4">
            <StreamCard title="Cams" description="Four spectator cams for the current match, one per player, each titled for OBS.">
                {!view.supported && <p role="alert" className="text-xs text-red-300">The cam tool runs on Windows only.</p>}

                <div className="space-y-2">
                    <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground">Servers</h3>
                    <div className="grid min-w-0 gap-3 md:grid-cols-2">
                        {CAM_TEAMS.map(team => (
                            <TeamServerPicker
                                key={team}
                                view={view.teams[team]}
                                servers={servers}
                                disabled={pending}
                                onChange={choice => changeChoice(team, choice)}
                            />
                        ))}
                    </div>
                    {view.layout && (
                        <p data-testid="cam-layout" className="text-xs text-muted-foreground break-words">
                            {view.layout === 'one-server'
                                ? 'Both teams are on one server, so all four cams join it.'
                                : "The teams are on two servers, so each team's cams join its own."}
                        </p>
                    )}
                    {serversFailed && <p className="text-xs text-amber-300">Could not refresh the server list, retrying.</p>}
                </div>

                <FpsPicker fps={fps} onChoose={next => void chooseFps(next)} saveFailed={fpsSaveFailed} disabled={pending} />

                {launchBlockers.length > 0 && (
                    <ul aria-label="Why the cams can't launch" className="space-y-1.5">
                        {launchBlockers.map(blocker => (
                            <li key={`${blocker.code}-${'team' in blocker ? blocker.team : ''}`} className="flex items-start gap-2 text-xs text-amber-300">
                                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                                <span className="min-w-0 break-words">
                                    {blocker.message}
                                    {blocker.code === 'install-path' && (
                                        <button type="button" onClick={openInstallSettings} className={cn(ACTION_SHAPE, MUTED_ACTION, 'ml-2 mt-1 h-7')}>
                                            <Settings className="size-3.5" aria-hidden="true" /> Open settings
                                        </button>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        disabled={pending || !request}
                        onClick={() => request && void launch(request)}
                        className={cn(ACTION_SHAPE, ACCENT_ACTION)}
                    >
                        <Play className="size-3.5" aria-hidden="true" /> {view.anyRunning ? 'Relaunch cams' : 'Launch cams'}
                    </button>
                    <button
                        type="button"
                        disabled={pending || !view.anyRunning}
                        onClick={() => void stopAll()}
                        className={cn(ACTION_SHAPE, DANGER_ACTION)}
                    >
                        <Square className="size-3.5" aria-hidden="true" /> Stop all
                    </button>
                    {pending && <span role="status" className="text-xs text-muted-foreground">Working…</span>}
                </div>

                {errors.length > 0 && (
                    <ul role="alert" className="space-y-1">
                        {errors.map(message => <li key={message} className="text-xs text-red-300 break-words">{message}</li>)}
                    </ul>
                )}
                {view.retitleError && <p className="text-xs text-amber-300 break-words">{view.retitleError}</p>}
                {view.staleSlots.length > 0 && (
                    <p role="status" data-testid="cam-stale-summary" className="text-xs text-amber-300 break-words">
                        The lineup changed. Restart {view.staleSlots.join(', ')} to follow the new {view.staleSlots.length === 1 ? 'player' : 'players'}.
                    </p>
                )}

                <ul aria-label="Cams" className="grid min-w-0 gap-3 xl:grid-cols-2">
                    {view.cams.map(cam => (
                        <CamRow key={cam.slot} cam={cam} disabled={pending} onRestart={slot => void restart(slot)} />
                    ))}
                </ul>
            </StreamCard>
        </div>
    )
}
