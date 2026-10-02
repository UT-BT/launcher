import type { CamRequest, CamToolStatus } from '@/lib/conveyor/schemas/stream-kit-schema'
import {
    CAM_PASSWORD_MAX_LENGTH,
    CAM_SLOTS,
    CAM_WINDOW_TITLES,
    isValidServerPassword,
    parseServerAddress,
    type CamFps,
    type CamSlot,
    type CamTeam,
} from '@/lib/stream-kit/cam-plan'
import { isDiscordId } from '@/lib/stream-kit/discord-id'
import { detectTeamServers } from '@/lib/stream-kit/team-server-detection'
import type { Server } from '@/app/utils/server-utils'
import type { StreamDesk, StreamMatch, StreamPerson } from '../../streamDesk'

export type CamServerChoice =
    | { mode: 'detected' }
    | { mode: 'list'; address: string }
    | { mode: 'typed'; address: string }

export type CamServerChoices = Record<CamTeam, CamServerChoice>

export const DETECTED_CHOICES: CamServerChoices = { A: { mode: 'detected' }, B: { mode: 'detected' } }

export type CamServerPasswords = Record<CamTeam, string>

export const NO_PASSWORDS: CamServerPasswords = { A: '', B: '' }

export const CAM_TEAMS: readonly CamTeam[] = ['A', 'B']

const DEFAULT_PORT = 7777
const SETTINGS_HINT = 'Set it in Settings > Game Installation.'

type CamToolFailure = Extract<Awaited<ReturnType<Window['conveyor']['streamKit']['launchCams']>>, { ok: false }>
export type CamToolError = CamToolFailure['errors'][number]
export type CamStatus = CamToolStatus['cams'][number]

export interface CamToolViewInput {
    desk: StreamDesk | null
    servers: readonly Server[] | null
    choices: CamServerChoices
    passwords: CamServerPasswords
    installPath: string | null | undefined
    status: CamToolStatus | null
    fps: CamFps | undefined
    volume: number | undefined
}

export type CamServerProblem = 'loading' | 'not-detected' | 'invalid-address'

export interface CamTeamServerView {
    team: CamTeam
    teamName: string
    choice: CamServerChoice
    detected: { address: string; serverName: string; found: number; rosterSize: number } | null
    source: CamServerChoice['mode'] | null
    address: string | null
    serverName: string | null
    uncertified: boolean
    problem: CamServerProblem | null
}

export interface CamTeamPasswordView {
    team: CamTeam
    value: string
    effective: string
    sharedFrom: CamTeam | null
    invalid: boolean
}

export interface CamLineupSlotView {
    slot: CamSlot
    team: CamTeam
    windowTitle: string
    person: StreamPerson | null
    discordId: string | null
    problem: 'empty' | 'unlinked' | null
}

export type CamLaunchBlocker =
    | { code: 'no-match'; message: string }
    | { code: 'lineup'; slots: CamSlot[]; message: string }
    | { code: 'server'; team: CamTeam; message: string }
    | { code: 'password'; team: CamTeam; message: string }
    | { code: 'install-path'; message: string }

export interface CamLaunchView {
    request: CamRequest | null
    blockers: CamLaunchBlocker[]
}

export interface CamStatusView {
    slot: CamSlot
    lineup: CamLineupSlotView
    windowTitle: string
    running: boolean
    titled: boolean
    server: string | null
    serverName: string | null
    movedServer: boolean
    target: { discordId: string; name: string | null } | null
    stale: boolean
    staleMessage: string | null
    exitNote: string | null
}

export interface CamToolView {
    teams: Record<CamTeam, CamTeamServerView>
    passwords: Record<CamTeam, CamTeamPasswordView>
    layout: 'one-server' | 'two-servers' | null
    lineup: CamLineupSlotView[]
    launch: CamLaunchView
    cams: CamStatusView[]
    anyRunning: boolean
    staleSlots: CamSlot[]
    supported: boolean
    retitleError: string | null
}

export function serverAddressOf(server: Pick<Server, 'ip' | 'hostport'>): string {
    return `${server.ip}:${server.hostport}`
}

export function normaliseTypedAddress(value: string): string | null {
    const bare = value.trim().replace(/^unreal:\/\//i, '').split('/')[0]
    if (!bare) return null
    const parsed = parseServerAddress(bare.includes(':') ? bare : `${bare}:${DEFAULT_PORT}`)
    return parsed ? `${parsed.host}:${parsed.port}` : null
}

function teamOf(slot: CamSlot): CamTeam {
    return slot.startsWith('A') ? 'A' : 'B'
}

function lineupPerson(match: StreamMatch | null, slot: CamSlot): StreamPerson | null {
    if (!match) return null
    return match.lineup[slot.toLowerCase() as keyof StreamMatch['lineup']] ?? null
}

function buildLineup(match: StreamMatch | null): CamLineupSlotView[] {
    return CAM_SLOTS.map(slot => {
        const person = lineupPerson(match, slot)
        const linked = person !== null && isDiscordId(person.id)
        return {
            slot,
            team: teamOf(slot),
            windowTitle: CAM_WINDOW_TITLES[slot],
            person,
            discordId: linked ? person.id : null,
            problem: person === null ? 'empty' : linked ? null : 'unlinked',
        }
    })
}

function teamName(match: StreamMatch | null, team: CamTeam): string {
    const name = match?.teams[team === 'A' ? 'a' : 'b']?.name
    return name ? name : `Team ${team}`
}

function rosterIds(match: StreamMatch | null, team: CamTeam): string[] {
    if (!match) return []
    const side = team === 'A' ? 'a' : 'b'
    const members = match.teams[side]?.members.map(member => member.id) ?? []
    const lineup = CAM_SLOTS.filter(slot => teamOf(slot) === team).map(slot => lineupPerson(match, slot)?.id)
    return [...new Set([...members, ...lineup].filter(isDiscordId))]
}

function listedServer(servers: readonly Server[] | null, address: string | null): Server | null {
    if (!servers || !address) return null
    return servers.find(server => serverAddressOf(server) === address) ?? null
}

function serverNameOf(servers: readonly Server[] | null, address: string | null): string | null {
    return listedServer(servers, address)?.hostname || null
}

function buildTeams(match: StreamMatch | null, servers: readonly Server[] | null, choices: CamServerChoices): Record<CamTeam, CamTeamServerView> {
    const rosters = { A: rosterIds(match, 'A'), B: rosterIds(match, 'B') }
    const detection = servers ? detectTeamServers(servers, rosters) : null

    const build = (team: CamTeam): CamTeamServerView => {
        const found = detection?.[team]
        const best = found?.best ?? null
        const detected = best && found
            ? { address: serverAddressOf(best), serverName: best.hostname, found: found.servers[0].count, rosterSize: rosters[team].length }
            : null
        const choice = choices[team]
        const base = { team, teamName: teamName(match, team), choice, detected }
        const withAddress = (source: CamServerChoice['mode'], address: string | null, problem: CamServerProblem | null): CamTeamServerView => {
            const listed = listedServer(servers, address)
            return { ...base, source, address, serverName: listed?.hostname || null, uncertified: listed !== null && !listed.certified_records, problem }
        }

        if (choice.mode === 'list') return withAddress('list', choice.address, null)
        if (choice.mode === 'typed') {
            const address = normaliseTypedAddress(choice.address)
            return withAddress('typed', address, address ? null : 'invalid-address')
        }
        if (!servers) return { ...base, source: null, address: null, serverName: null, uncertified: false, problem: 'loading' }
        if (!detected) return { ...base, source: null, address: null, serverName: null, uncertified: false, problem: 'not-detected' }
        return withAddress('detected', detected.address, null)
    }

    return { A: build('A'), B: build('B') }
}

function otherTeam(team: CamTeam): CamTeam {
    return team === 'A' ? 'B' : 'A'
}

function buildPasswords(teams: Record<CamTeam, CamTeamServerView>, passwords: CamServerPasswords): Record<CamTeam, CamTeamPasswordView> {
    const build = (team: CamTeam): CamTeamPasswordView => {
        const own = passwords[team].trim()
        const other = otherTeam(team)
        const otherOwn = passwords[other].trim()
        const address = teams[team].address
        const shared = own === '' && otherOwn !== '' && isValidServerPassword(otherOwn)
            && address !== null && address === teams[other].address
        return {
            team,
            value: passwords[team],
            effective: shared ? otherOwn : own,
            sharedFrom: shared ? other : null,
            invalid: !isValidServerPassword(own),
        }
    }

    return { A: build('A'), B: build('B') }
}

function passwordBlockerMessage(teamName: string): string {
    return `The password typed for ${teamName} can't be sent to the game. It can't contain spaces, ?, # or ", and it can be at most ${CAM_PASSWORD_MAX_LENGTH} characters.`
}

function serverBlockerMessage(view: CamTeamServerView): string {
    if (view.problem === 'invalid-address') {
        return `The address typed for ${view.teamName} can't be joined. Use host:port, for example 203.0.113.5:7777.`
    }
    return `No ${view.teamName} player is on a listed server. Pick their server or type its address.`
}

function lineupBlockerMessage(slots: CamSlot[]): string {
    const names = slots.join(', ')
    const verb = slots.length === 1 ? 'has' : 'have'
    return `${names} ${verb} no player with a linked Discord account, so the cam can't follow anyone. Set the lineup in the Match panel.`
}

function buildLaunch(
    match: StreamMatch | null,
    lineup: CamLineupSlotView[],
    teams: Record<CamTeam, CamTeamServerView>,
    passwords: Record<CamTeam, CamTeamPasswordView>,
    installPath: string | null | undefined,
    fps: CamFps | undefined,
    volume: number | undefined,
): CamLaunchView {
    const blockers: CamLaunchBlocker[] = []
    const installMissing = installPath !== undefined && !(installPath ?? '').trim()

    if (!match) {
        blockers.push({ code: 'no-match', message: 'No match is on your scenes. Pick the current match in the Match panel.' })
    } else {
        const missing = lineup.filter(slot => slot.problem !== null).map(slot => slot.slot)
        if (missing.length > 0) blockers.push({ code: 'lineup', slots: missing, message: lineupBlockerMessage(missing) })
        for (const team of CAM_TEAMS) {
            const view = teams[team]
            if (view.problem && view.problem !== 'loading') blockers.push({ code: 'server', team, message: serverBlockerMessage(view) })
        }
        for (const team of CAM_TEAMS) {
            if (passwords[team].invalid) blockers.push({ code: 'password', team, message: passwordBlockerMessage(teams[team].teamName) })
        }
    }
    if (installMissing) {
        blockers.push({ code: 'install-path', message: `The cams start from your own UT install, and the launcher doesn't know where it is. ${SETTINGS_HINT}` })
    }

    const ready = blockers.length === 0 && match !== null && installPath !== undefined && fps !== undefined && volume !== undefined
        && CAM_TEAMS.every(team => teams[team].address !== null)
    const idOf = (slot: CamSlot) => lineup.find(entry => entry.slot === slot)?.discordId ?? null
    const request: CamRequest | null = ready
        ? {
            lineup: { A1: idOf('A1'), A2: idOf('A2'), B1: idOf('B1'), B2: idOf('B2') },
            servers: { A: teams.A.address, B: teams.B.address },
            passwords: { A: passwords.A.effective || null, B: passwords.B.effective || null },
            fps,
            volume,
        }
        : null

    return { request, blockers }
}

function knownNames(match: StreamMatch | null): Map<string, string | null> {
    const names = new Map<string, string | null>()
    if (!match) return names
    for (const side of ['a', 'b'] as const) {
        for (const member of match.teams[side]?.members ?? []) names.set(member.id, member.display_name)
    }
    for (const slot of CAM_SLOTS) {
        const person = lineupPerson(match, slot)
        if (person) names.set(person.id, person.display_name ?? names.get(person.id) ?? null)
    }
    return names
}

function staleMessage(slot: CamSlot, canRelaunch: boolean): string {
    if (canRelaunch) return `Restart cam ${slot}: it follows a different player from the lineup's ${slot}.`
    return `Cam ${slot} follows a different player from the lineup's ${slot}. Fix the launch problems above first: until then, restarting it keeps its old player.`
}

function exitNote(cam: CamStatus): string | null {
    if (cam.running) return null
    if (cam.error) return cam.error
    if (cam.exitCode !== null && cam.exitCode !== 0) return `Closed with code ${cam.exitCode}.`
    return null
}

function buildCams(
    status: CamToolStatus | null,
    lineup: CamLineupSlotView[],
    names: Map<string, string | null>,
    servers: readonly Server[] | null,
    canRelaunch: boolean,
): CamStatusView[] {
    return lineup.map(lineupSlot => {
        const cam = status?.cams.find(entry => entry.slot === lineupSlot.slot) ?? null
        const running = cam?.running ?? false
        const targetId = cam?.target ?? null
        const target = targetId ? { discordId: targetId, name: names.get(targetId) ?? null } : null
        const stale = running && target !== null && target.discordId !== lineupSlot.discordId
        const server = running ? cam?.server ?? null : null
        return {
            slot: lineupSlot.slot,
            lineup: lineupSlot,
            windowTitle: cam?.windowTitle ?? lineupSlot.windowTitle,
            running,
            titled: running && (cam?.titled ?? false),
            server,
            serverName: serverNameOf(servers, server),
            movedServer: running && server !== null && cam?.plannedServer != null && server !== cam.plannedServer,
            target,
            stale,
            staleMessage: stale ? staleMessage(lineupSlot.slot, canRelaunch) : null,
            exitNote: cam ? exitNote(cam) : null,
        }
    })
}

export function buildCamToolView({ desk, servers, choices, passwords, installPath, status, fps, volume }: CamToolViewInput): CamToolView {
    const match = desk?.match ?? null
    const lineup = buildLineup(match)
    const teams = buildTeams(match, servers, choices)
    const teamPasswords = buildPasswords(teams, passwords)
    const launch = buildLaunch(match, lineup, teams, teamPasswords, installPath, fps, volume)
    const cams = buildCams(status, lineup, knownNames(match), servers, launch.request !== null)
    const addresses = CAM_TEAMS.map(team => teams[team].address)

    return {
        teams,
        passwords: teamPasswords,
        layout: addresses.every(address => address !== null)
            ? addresses[0] === addresses[1] ? 'one-server' : 'two-servers'
            : null,
        lineup,
        launch,
        cams,
        anyRunning: cams.some(cam => cam.running),
        staleSlots: cams.filter(cam => cam.stale).map(cam => cam.slot),
        supported: status?.supported ?? true,
        retitleError: status && !status.retitle.available
            ? `Window titles can't be set${status.retitle.error ? ` (${status.retitle.error})` : ''}, so OBS won't find the cams by title.`
            : null,
    }
}

export function camErrorMessage(error: CamToolError): string {
    switch (error.code) {
        case 'missing-install-path':
        case 'no-install':
            return `The launcher doesn't know where UT is installed. ${SETTINGS_HINT}`
        case 'missing-executable':
            return `UnrealTournament.exe wasn't found in your install's System folder. Check the path in Settings > Game Installation.`
        case 'missing-ini':
        case 'ini-unreadable':
            return `Your ${error.file === 'main' ? 'UnrealTournament.ini' : 'User.ini'} couldn't be read. Start UT once so it writes its settings, then retry.`
        case 'missing-slot':
            return `${error.slot} has no player in the lineup.`
        case 'invalid-discord-id':
            return `${error.slot} has no player with a linked Discord account.`
        case 'missing-server':
            return `Team ${error.team} has no server.`
        case 'invalid-server':
            return `Team ${error.team}'s server address (${error.value}) can't be joined.`
        case 'invalid-password':
            return `Team ${error.team}'s server password can't be sent to the game.`
        case 'unsupported-platform':
            return 'The cam tool runs on Windows only.'
        case 'write-failed':
            return `Cam ${error.slot}'s settings files couldn't be written to your install's System folder.`
        case 'not-launched':
            return `Cam ${error.slot} hasn't been launched yet. Launch the cams first.`
    }
}

export function camErrorMessages(errors: readonly CamToolError[]): string[] {
    return [...new Set(errors.map(camErrorMessage))]
}
