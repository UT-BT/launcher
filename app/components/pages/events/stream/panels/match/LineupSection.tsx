import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CHIP_SHAPE } from '@/app/components/shared/chipStyles'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { fetchGatewayServers } from '@/app/platform'
import { ApiError, toActiveTitle } from '@/app/utils/api'
import { createPoller } from '@/app/utils/poller'
import { trimServerName, type Server } from '@/app/utils/server-utils'
import { StreamCard, StreamLoading } from '../../StreamCard'
import { useStreamTab } from '../../StreamTabContext'
import { UncertifiedServerWarning } from '../../UncertifiedServerWarning'
import { deskPollEnvironment, type StreamMatch, type StreamSide } from '../../streamDesk'
import { fetchStreamLineup, saveStreamLineup, type StreamLineup } from './lineupActions'
import {
    EMPTY_LINEUP,
    LINEUP_SLOTS,
    SERVER_POLL_MS,
    SIDE_SLOTS,
    STREAM_SIDES,
    buildLineupTeams,
    detectLineup,
    effectiveLineupOf,
    foundIds,
    hasLineupBlock,
    isLineupEmpty,
    pickPlayer,
    shouldAutoApply,
    suggestLineup,
    swapSide,
    uncertifiedTeamServers,
    type FoundMembers,
    type LineupPlayer,
    type LineupSeat,
    type LineupSlots,
    type LineupSuggestion,
    type LineupTeam,
} from './lineupView'

const SECTION_TITLE = 'Lineup'
const SECTION_DESCRIPTION = 'Who plays for each team, and who sits left or right. Name tags and cams follow it.'
const LINEUP_SET_REASON = 'lineup_set'

const ACTION_SHAPE = 'h-8 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer flex items-center gap-2 disabled:cursor-default disabled:opacity-50'
const ACCENT_ACTION = 'bg-accent-500/15 border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:border-accent-500/60'
const MUTED_ACTION = 'bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20'
const SIDE_CHIP_STYLE = 'bg-card/60 text-foreground border-hairline/20'
const DEFAULT_CHIP_STYLE = 'bg-card/50 text-muted-foreground border-hairline/10'

function errorText(error: unknown): string {
    return error instanceof Error && error.message ? error.message : 'Something went wrong.'
}

function teamLabel(team: LineupTeam<Server>): string {
    return team.name ?? `Team ${team.side.toUpperCase()}`
}

function serverNames(servers: Server[]): string {
    return servers.map(server => trimServerName(server.hostname)).join(', ')
}

function useGameServers(active: boolean) {
    const [servers, setServers] = useState<Server[] | null>(null)
    const [error, setError] = useState<unknown>(null)

    useEffect(() => {
        if (!active) return
        const poller = createPoller({
            intervalMs: () => SERVER_POLL_MS,
            environment: deskPollEnvironment(),
            poll: async (signal) => {
                const list = await fetchGatewayServers()
                if (signal.aborted) return
                setServers(list)
                setError(null)
            },
            onSettled: ({ ok, error: failure }) => {
                if (!ok) setError(failure)
            },
        })
        poller.start()
        return () => poller.stop()
    }, [active])

    return { servers, error }
}

function useStoredLineup(accessToken: string, slug: string, match: StreamMatch) {
    const [stored, setStored] = useState<StreamLineup | null>(null)
    const [error, setError] = useState<unknown>(null)
    const [reloads, setReloads] = useState(0)
    const writes = useRef(0)
    const effectiveKey = LINEUP_SLOTS.map(slot => match.lineup[slot]?.id ?? '').join(',')

    useEffect(() => {
        const controller = new AbortController()
        const startedAfter = writes.current
        fetchStreamLineup(accessToken, slug, match.id, controller.signal).then(
            read => {
                if (controller.signal.aborted || writes.current !== startedAfter) return
                setStored(read)
                setError(null)
            },
            failure => {
                if (!controller.signal.aborted) setError(failure)
            },
        )
        return () => controller.abort()
    }, [accessToken, slug, match.id, effectiveKey, reloads])

    const reload = useCallback(() => setReloads(count => count + 1), [])
    const acceptWrite = useCallback((written: StreamLineup) => {
        writes.current += 1
        setStored(written)
        setError(null)
    }, [])

    return { stored: stored?.matchId === match.id ? stored.lineup : null, error, acceptWrite, reload }
}

function Chip({ className, children }: { className: string; children: string }) {
    return <span className={cn(CHIP_SHAPE, className)}>{children}</span>
}

function PlayerLine({ player }: { player: LineupPlayer<Server> }) {
    return (
        <PlayerInfo
            userId={player.id}
            alias={player.displayName}
            title={toActiveTitle(player.title)}
            size="sm"
            interactive={false}
            className="min-w-0"
        />
    )
}

function FoundOn({ player, checked }: { player: LineupPlayer<Server>; checked: boolean }) {
    if (!checked) return null
    return (
        <p className={cn('text-[11px] break-words', player.foundOn.length > 0 ? 'text-emerald-300' : 'text-muted-foreground')}>
            {player.foundOn.length > 0 ? `In game on ${serverNames(player.foundOn)}` : 'Not found in game'}
        </p>
    )
}

function Seat({ label, seat, checked }: { label: string; seat: LineupSeat<Server> | null; checked: boolean }) {
    return (
        <div data-testid={`seat-${label.toLowerCase()}`} className="min-w-0 space-y-1 rounded-md border border-hairline/10 bg-card/30 p-2">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
                {seat && !seat.pinned && <Chip className={DEFAULT_CHIP_STYLE}>Default</Chip>}
            </div>
            {seat ? (
                <>
                    <PlayerLine player={seat} />
                    <FoundOn player={seat} checked={checked} />
                </>
            ) : (
                <p className="text-xs text-muted-foreground">Nobody</p>
            )}
        </div>
    )
}

interface TeamLineupProps {
    team: LineupTeam<Server>
    checked: boolean
    disabled: boolean
    onSwap: () => void
    onPick: (position: 0 | 1, userId: string) => void
}

function TeamLineup({ team, checked, disabled, onSwap, onPick }: TeamLineupProps) {
    const name = teamLabel(team)

    return (
        <section aria-label={`${name} lineup`} className="min-w-0 space-y-3 rounded-lg border border-hairline/10 bg-card/40 p-3">
            <header className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <Chip className={SIDE_CHIP_STYLE}>{team.side.toUpperCase()}</Chip>
                    <p className="min-w-0 text-sm font-semibold text-foreground break-words">{name}</p>
                </div>
                <button
                    type="button"
                    disabled={disabled || !team.canSwap}
                    onClick={onSwap}
                    aria-label={`Swap ${name} left and right`}
                    className={cn(ACTION_SHAPE, MUTED_ACTION)}
                >
                    <ArrowLeftRight className="size-3.5" aria-hidden />
                    Swap
                </button>
            </header>

            <div className="grid gap-2 sm:grid-cols-2">
                <Seat label="Left" seat={team.left} checked={checked} />
                <Seat label="Right" seat={team.right} checked={checked} />
            </div>

            {team.choosable ? (
                <ul aria-label={`${name} roster`} className="space-y-1.5">
                    {team.roster.map(player => (
                        <li key={player.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-hairline/10 bg-card/30 px-2 py-1.5">
                            <div className="min-w-0 space-y-0.5">
                                <PlayerLine player={player} />
                                <FoundOn player={player} checked={checked} />
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                                {(['left', 'right'] as const).map((position, index) => (
                                    <button
                                        key={position}
                                        type="button"
                                        disabled={disabled}
                                        aria-pressed={player.slot === position}
                                        aria-label={`Put ${player.displayName ?? 'this player'} on the ${position}`}
                                        onClick={() => onPick(index as 0 | 1, player.id)}
                                        className={cn(ACTION_SHAPE, player.slot === position ? ACCENT_ACTION : MUTED_ACTION)}
                                    >
                                        {position === 'left' ? 'Left' : 'Right'}
                                    </button>
                                ))}
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-xs text-muted-foreground">Two-player roster: both play, so there is nothing to choose.</p>
            )}
        </section>
    )
}

function sideSummary(team: LineupTeam<Server>, found: FoundMembers<Server>[StreamSide]): string {
    const name = teamLabel(team)
    if (found.length === 0) return `${name}: nobody found in game.`
    if (found.length > 2) return `${name}: ${found.length} found in game, so choose the two players by hand.`
    const servers = [...new Set(found.flatMap(entry => entry.servers))]
    return `${name}: ${found.length} found in game on ${serverNames(servers)}.`
}

interface DetectionProps {
    teams: Record<StreamSide, LineupTeam<Server>>
    servers: Server[] | null
    serverError: unknown
    found: FoundMembers<Server>
    uncertifiedServers: Record<StreamSide, Server | null>
    suggestion: LineupSuggestion | null
    disabled: boolean
    notice: string | null
    onApply: () => void
}

function Detection({ teams, servers, serverError, found, uncertifiedServers, suggestion, disabled, notice, onApply }: DetectionProps) {
    const playerOf = (side: StreamSide, id: string) => teams[side].roster.find(player => player.id === id)
        ?? { id, displayName: null, title: null, captain: false, foundOn: [] }
    const changedSides = STREAM_SIDES.flatMap(side => {
        const pair = suggestion?.pairs[side] ?? null
        return pair !== null && (pair[0] !== teams[side].left?.id || pair[1] !== teams[side].right?.id) ? [{ side, pair }] : []
    })

    return (
        <div data-testid="lineup-detection" className="space-y-2 rounded-lg border border-hairline/10 bg-card/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Found in game</p>
            {servers === null ? (
                <p className="text-xs text-muted-foreground">
                    {serverError ? `Could not read the game servers, retrying. ${errorText(serverError)}` : 'Checking the game servers…'}
                </p>
            ) : (
                <ul className="space-y-1.5">
                    {STREAM_SIDES.map(side => (
                        <li key={side} className="space-y-1 text-xs text-muted-foreground break-words">
                            <p>{sideSummary(teams[side], found[side])}</p>
                            {uncertifiedServers[side] && <UncertifiedServerWarning testId={`lineup-${side}-uncertified`} />}
                        </li>
                    ))}
                </ul>
            )}
            {servers !== null && serverError !== null && (
                <p className="text-xs text-amber-300">Could not refresh the game servers, retrying.</p>
            )}
            {changedSides.length > 0 && suggestion && (
                <div className="space-y-2 rounded-md border border-accent-500/30 bg-accent-500/5 p-2">
                    <p className="text-xs font-medium text-foreground">Suggestion from the game servers</p>
                    <ul aria-label="Suggested lineup" className="space-y-1.5">
                        {changedSides.map(({ side, pair }) => (
                            <li key={side} className="flex flex-wrap items-center gap-2">
                                <Chip className={SIDE_CHIP_STYLE}>{side.toUpperCase()}</Chip>
                                {(['Left', 'Right'] as const).map((label, index) => (
                                    <span key={label} className="flex min-w-0 items-center gap-2">
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
                                        <PlayerLine player={playerOf(side, pair[index])} />
                                    </span>
                                ))}
                            </li>
                        ))}
                    </ul>
                    <button type="button" disabled={disabled} onClick={onApply} className={cn(ACTION_SHAPE, ACCENT_ACTION)}>
                        Apply suggestion
                    </button>
                </div>
            )}
            {notice && <p role="status" className="text-xs text-emerald-300">{notice}</p>}
            <p className="text-[11px] text-muted-foreground">Checked about every 30 seconds while this section is open.</p>
        </div>
    )
}

interface LineupEditorProps {
    match: StreamMatch
    servers: Server[] | null
    serverError: unknown
}

function LineupEditor({ match, servers, serverError }: LineupEditorProps) {
    const { eventSlug, accessToken, refresh } = useStreamTab()
    const { stored, error: storedError, acceptWrite, reload } = useStoredLineup(accessToken, eventSlug, match)
    const writing = useRef(false)
    const attempted = useRef(new Set<string>())
    const handPicked = useRef(false)
    const [pending, setPending] = useState(false)
    const [writeError, setWriteError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)

    const found = useMemo(() => detectLineup(servers ?? [], match), [servers, match])
    const uncertifiedServers = useMemo(() => uncertifiedTeamServers(servers ?? [], match), [servers, match])
    const effective = effectiveLineupOf(match)
    const teams = buildLineupTeams(match, stored ?? EMPTY_LINEUP, found)
    const suggestion = useMemo(
        () => (servers === null ? null : suggestLineup(effectiveLineupOf(match), stored ?? EMPTY_LINEUP, foundIds(found))),
        [servers, found, stored, match],
    )

    const save = useCallback(async (lineup: LineupSlots, auto: boolean) => {
        if (writing.current) return
        writing.current = true
        if (!auto) handPicked.current = true
        setPending(true)
        setWriteError(null)
        setNotice(null)
        try {
            acceptWrite(await saveStreamLineup(accessToken, eventSlug, match.id, lineup, { onlyIfEmpty: auto }))
            if (auto) setNotice('Applied the players found in game.')
        } catch (error) {
            if (auto && error instanceof ApiError && error.reason === LINEUP_SET_REASON) reload()
            else setWriteError(errorText(error))
        } finally {
            await refresh()
            writing.current = false
            setPending(false)
        }
    }, [accessToken, eventSlug, match.id, refresh, reload, acceptWrite])

    useEffect(() => {
        if (!suggestion || pending || handPicked.current || !shouldAutoApply(stored, suggestion)) return
        const key = LINEUP_SLOTS.map(slot => suggestion.lineup[slot] ?? '').join(',')
        if (attempted.current.has(key)) return
        attempted.current.add(key)
        void save(suggestion.lineup, true)
    }, [suggestion, stored, pending, save])

    const disabled = pending || stored === null
    const current = stored ?? EMPTY_LINEUP

    return (
        <>
            <Detection
                teams={teams}
                servers={servers}
                serverError={serverError}
                found={found}
                uncertifiedServers={uncertifiedServers}
                suggestion={suggestion}
                disabled={disabled}
                notice={notice}
                onApply={() => suggestion && save(suggestion.lineup, false)}
            />

            <div className="grid gap-3 lg:grid-cols-2">
                {STREAM_SIDES.map(side => (
                    <TeamLineup
                        key={side}
                        team={teams[side]}
                        checked={servers !== null}
                        disabled={disabled}
                        onSwap={() => save(swapSide(effective, current, side), false)}
                        onPick={(position, userId) => save(pickPlayer(effective, current, SIDE_SLOTS[side][position], userId), false)}
                    />
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {stored !== null && !isLineupEmpty(stored) && (
                    <button type="button" disabled={disabled} onClick={() => save(EMPTY_LINEUP, false)} className={cn(ACTION_SHAPE, MUTED_ACTION)}>
                        Use the default lineup
                    </button>
                )}
                {stored === null && !storedError && <StreamLoading label="the lineup" />}
            </div>

            {storedError !== null && stored === null && (
                <p role="alert" className="text-xs text-red-300">The lineup could not be loaded. {errorText(storedError)}</p>
            )}
            {writeError && <p role="alert" className="text-xs text-red-300">{writeError}</p>}
        </>
    )
}

export function LineupSection() {
    const { desk, deskLoading, deskError } = useStreamTab()
    const match = desk?.match ?? null
    const readable = match !== null && hasLineupBlock(match)
    const { servers, error: serverError } = useGameServers(readable)

    return (
        <StreamCard title={SECTION_TITLE} description={SECTION_DESCRIPTION}>
            {!desk ? (
                deskLoading || !deskError
                    ? <StreamLoading label="the lineup" />
                    : <p role="alert" className="text-xs text-red-300">The lineup could not be loaded. {errorText(deskError)}</p>
            ) : match === null ? (
                <p className="text-xs text-muted-foreground">No match is on your scenes, so there is no lineup to set.</p>
            ) : !readable ? (
                <p role="alert" className="text-xs text-red-300">The lineup of this match could not be read.</p>
            ) : (
                <LineupEditor key={match.id} match={match} servers={servers} serverError={serverError} />
            )}
        </StreamCard>
    )
}
