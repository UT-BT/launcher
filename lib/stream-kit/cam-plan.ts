import { isDiscordId } from './discord-id'

export type CamTeam = 'A' | 'B'
export type CamSlot = 'A1' | 'A2' | 'B1' | 'B2'

export const CAM_SLOTS: readonly CamSlot[] = ['A1', 'A2', 'B1', 'B2']

export const CAM_JOIN_OPTIONS = {
    spectatorClass: { name: 'OverrideClass', value: 'Botpack.CHSpectator' },
    quietJoin: { name: 'UTBTSpectator', value: 'True' },
    follow: { name: 'UTBTFollow' },
    hud: { name: 'UTBTHud', value: 'Broadcast' },
    muteJoinLeave: { name: 'UTBTMuteJoinLeave', value: 'True' },
} as const

export const CAM_WINDOW_TITLES: Readonly<Record<CamSlot, string>> = {
    A1: 'UTBT Cam A1',
    A2: 'UTBT Cam A2',
    B1: 'UTBT Cam B1',
    B2: 'UTBT Cam B2',
}

export interface IniOverride {
    section: string
    key: string
    value: string
}

export const CAM_INI_OVERRIDES: readonly IniOverride[] = [
    { section: 'WinDrv.WindowsClient', key: 'WindowedViewportX', value: '960' },
    { section: 'WinDrv.WindowsClient', key: 'WindowedViewportY', value: '540' },
    { section: 'WinDrv.WindowsClient', key: 'StartupFullscreen', value: 'False' },
    { section: 'WinDrv.WindowsClient', key: 'StartupBorderless', value: 'False' },
]

export type CamFps = 60 | 120

export const CAM_FPS_OPTIONS: readonly CamFps[] = [60, 120]

export const DEFAULT_CAM_FPS: CamFps = 120

export const CAM_MUSIC_VOLUME = 0

export const CAM_VOLUME_MAX = 100

export const DEFAULT_CAM_VOLUME = 50

const UT_VOLUME_MAX = 255

const ENGINE_SECTION = 'Engine.Engine'
const GLOBAL_FRAME_RATE_SECTION = 'WinDrv.WindowsClient'
const FRAME_RATE_KEY = 'FrameRateLimit'

export function camFpsOf(value: unknown): CamFps {
    return CAM_FPS_OPTIONS.find(fps => fps === value) ?? DEFAULT_CAM_FPS
}

export function camVolumeOf(value: unknown): number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= CAM_VOLUME_MAX
        ? value
        : DEFAULT_CAM_VOLUME
}

export function utVolumeOf(volume: number): number {
    return Math.round((camVolumeOf(volume) * UT_VOLUME_MAX) / CAM_VOLUME_MAX)
}

export interface CamIniSetting {
    key: string
    value: string
}

export const CAM_SHADER_GAMMA_SETTINGS: Readonly<Record<string, readonly CamIniSetting[]>> = {
    'D3D9Drv.D3D9RenderDevice': [
        { key: 'UseShaderGamma', value: '2' },
        { key: 'UseFragmentProgram', value: 'True' },
    ],
    'OpenGLDrv.OpenGLRenderDevice': [
        { key: 'UseShaderGamma', value: 'True' },
        { key: 'UseFragmentProgram', value: 'True' },
    ],
}

export const CAM_PASSWORD_MAX_LENGTH = 64

const PASSWORD_OPTION = 'password'
const PASSWORD_FORBIDDEN = /[\s?#"]/

export function isValidServerPassword(value: string): boolean {
    return value.length <= CAM_PASSWORD_MAX_LENGTH && !PASSWORD_FORBIDDEN.test(value)
}

export const CAM_USER_INI_OVERRIDES: readonly IniOverride[] = [
    { section: 'DefaultPlayer', key: CAM_JOIN_OPTIONS.spectatorClass.name, value: CAM_JOIN_OPTIONS.spectatorClass.value },
]

export interface CamPlanInput {
    installPath: string
    lineup: Partial<Record<CamSlot, string | null>>
    servers: Partial<Record<CamTeam, string | null>>
    passwords?: Partial<Record<CamTeam, string | null>>
    mainIni: string
    userIni: string
    fps: CamFps
    volume: number
}

export interface CamCommand {
    executable: string
    workingDirectory: string
    args: string[]
}

export interface CamFiles {
    ini: string
    userIni: string
    log: string
}

export interface CamPlanCam {
    slot: CamSlot
    team: CamTeam
    discordId: string
    server: string
    windowTitle: string
    joinOptions: Record<string, string>
    url: string
    files: CamFiles
    iniContent: string
    userIniContent: string
    command: CamCommand
}

export interface CamPlan {
    cams: CamPlanCam[]
}

export type CamPlanError =
    | { code: 'missing-install-path' }
    | { code: 'missing-ini'; file: 'main' | 'user' }
    | { code: 'missing-slot'; slot: CamSlot }
    | { code: 'invalid-discord-id'; slot: CamSlot; value: string }
    | { code: 'missing-server'; team: CamTeam }
    | { code: 'invalid-server'; team: CamTeam; value: string }
    | { code: 'invalid-password'; team: CamTeam }

export type CamPlanResult =
    | { ok: true; plan: CamPlan }
    | { ok: false; errors: CamPlanError[] }

export interface ServerAddress {
    host: string
    port: number
}

const CAM_TEAMS: readonly CamTeam[] = ['A', 'B']
const GAME_EXECUTABLE = 'UnrealTournament.exe'
const ADDRESS = /^([^:]+):(\d{1,5})$/
const HOST_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/
const NUMERIC_LABEL = /^\d+$/
const IPV4_OCTET = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/

function isValidHost(host: string): boolean {
    const labels = host.split('.')
    if (labels.every(label => NUMERIC_LABEL.test(label))) {
        return labels.length === 4 && labels.every(label => IPV4_OCTET.test(label))
    }
    return host.length <= 253 && labels.every(label => HOST_LABEL.test(label))
}

export function parseServerAddress(value: string): ServerAddress | null {
    const match = ADDRESS.exec(value.trim())
    if (!match) return null
    const [, host, portText] = match
    const port = Number(portText)
    if (port < 1 || port > 65535 || !isValidHost(host)) return null
    return { host, port }
}

const SECTION_HEADER = /^\s*\[([^\]]*)\]\s*$/
const KEY_LINE = /^\s*([^=]+?)\s*=/

function sameName(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function overrideLine(override: IniOverride): string {
    return `${override.key}=${override.value}`
}

function appendSection(lines: readonly string[], section: string, entries: readonly string[]): string[] {
    const endsWithNewline = lines.length > 1 && lines[lines.length - 1] === ''
    const body = endsWithNewline ? lines.slice(0, -1) : lines
    const content = body.length === 1 && body[0] === '' ? [] : body
    const separator = content.length > 0 && content[content.length - 1].trim() !== '' ? [''] : []
    return [...content, ...separator, `[${section}]`, ...entries, ...(endsWithNewline ? [''] : [])]
}

function applySectionOverrides(lines: readonly string[], section: string, overrides: readonly IniOverride[]): string[] {
    const result: string[] = []
    const written = new Set<IniOverride>()
    let inSection = false
    let position: 'before' | 'first' | 'after' = 'before'
    let insertAt = -1

    for (const line of lines) {
        const header = SECTION_HEADER.exec(line)?.[1]
        if (header !== undefined) {
            inSection = sameName(header, section)
            if (position === 'first') position = 'after'
            if (inSection && position === 'before') position = 'first'
        }
        const key = header === undefined && inSection ? KEY_LINE.exec(line)?.[1] : undefined
        const override = key === undefined ? undefined : overrides.find(candidate => sameName(candidate.key, key))
        if (override) written.add(override)
        result.push(override ? overrideLine(override) : line)
        if (position === 'first' && line.trim() !== '') insertAt = result.length
    }

    const missing = overrides.filter(override => !written.has(override)).map(overrideLine)
    if (missing.length === 0) return result
    if (insertAt === -1) return appendSection(result, section, missing)
    return [...result.slice(0, insertAt), ...missing, ...result.slice(insertAt)]
}

function applyIniOverrides(content: string, overrides: readonly IniOverride[]): string {
    const eol = content.includes('\r\n') ? '\r\n' : '\n'
    const sections = [...new Set(overrides.map(override => override.section))]
    const lines = sections.reduce<string[]>(
        (current, section) => applySectionOverrides(current, section, overrides.filter(override => override.section === section)),
        content.split(/\r?\n/),
    )
    return lines.join(eol)
}

function iniValue(content: string, section: string, key: string): string | null {
    let inSection = false
    for (const line of content.split(/\r?\n/)) {
        const header = SECTION_HEADER.exec(line)?.[1]
        if (header !== undefined) {
            inSection = sameName(header, section)
            continue
        }
        const name = inSection ? KEY_LINE.exec(line)?.[1] : undefined
        if (name !== undefined && sameName(name, key)) {
            const value = line.slice(line.indexOf('=') + 1).trim()
            return value === '' ? null : value
        }
    }
    return null
}

function shaderGammaOverrides(renderDevice: string): IniOverride[] {
    const settings = Object.entries(CAM_SHADER_GAMMA_SETTINGS).find(([device]) => sameName(device, renderDevice))?.[1] ?? []
    return settings.map(setting => ({ section: renderDevice, ...setting }))
}

function camIniOverrides(mainIni: string, fps: CamFps, volume: number): IniOverride[] {
    const renderDevice = iniValue(mainIni, ENGINE_SECTION, 'GameRenderDevice')
    const audioDevice = iniValue(mainIni, ENGINE_SECTION, 'AudioDevice')
    const frameRate = String(fps)
    const gameVolume = String(utVolumeOf(volume))
    return [
        ...CAM_INI_OVERRIDES,
        { section: GLOBAL_FRAME_RATE_SECTION, key: FRAME_RATE_KEY, value: frameRate },
        ...(renderDevice
            ? [{ section: renderDevice, key: FRAME_RATE_KEY, value: frameRate }, ...shaderGammaOverrides(renderDevice)]
            : []),
        ...(audioDevice
            ? [
                { section: audioDevice, key: 'MusicVolume', value: String(CAM_MUSIC_VOLUME) },
                { section: audioDevice, key: 'SoundVolume', value: gameVolume },
                { section: audioDevice, key: 'SpeechVolume', value: gameVolume },
            ]
            : []),
    ]
}

function camFilesFor(slot: CamSlot): CamFiles {
    return {
        ini: `UTBTCam${slot}.ini`,
        userIni: `UTBTCam${slot}User.ini`,
        log: `UTBTCam${slot}.log`,
    }
}

function systemDirectoryOf(installPath: string): string {
    return `${installPath.trim().replace(/[\\/]+$/, '')}\\System`
}

function teamOf(slot: CamSlot): CamTeam {
    return slot.startsWith('A') ? 'A' : 'B'
}

function joinOptionsFor(discordId: string): Record<string, string> {
    return Object.fromEntries(
        Object.values(CAM_JOIN_OPTIONS).map(option => [option.name, 'value' in option ? option.value : discordId]),
    )
}

function connectUrl(address: string, joinOptions: Record<string, string>, password: string): string {
    const options = Object.entries(joinOptions).map(([name, value]) => `?${name}=${value}`).join('')
    const passwordOption = password === '' ? '' : `?${PASSWORD_OPTION}=${password}`
    return `unreal://${address}${options}${passwordOption}`
}

export function buildCamPlan(input: CamPlanInput): CamPlanResult {
    const errors: CamPlanError[] = []
    if (input.installPath.trim() === '') errors.push({ code: 'missing-install-path' })
    if (input.mainIni.trim() === '') errors.push({ code: 'missing-ini', file: 'main' })
    if (input.userIni.trim() === '') errors.push({ code: 'missing-ini', file: 'user' })

    const discordIds: Partial<Record<CamSlot, string>> = {}
    for (const slot of CAM_SLOTS) {
        const value = input.lineup[slot]
        if (!value) errors.push({ code: 'missing-slot', slot })
        else if (!isDiscordId(value)) errors.push({ code: 'invalid-discord-id', slot, value })
        else discordIds[slot] = value
    }

    const servers: Partial<Record<CamTeam, string>> = {}
    for (const team of CAM_TEAMS) {
        const value = input.servers[team] ?? ''
        const address = parseServerAddress(value)
        if (value.trim() === '') errors.push({ code: 'missing-server', team })
        else if (!address) errors.push({ code: 'invalid-server', team, value })
        else servers[team] = `${address.host}:${address.port}`
    }

    const passwords: Partial<Record<CamTeam, string>> = {}
    for (const team of CAM_TEAMS) {
        const value = (input.passwords?.[team] ?? '').trim()
        if (!isValidServerPassword(value)) errors.push({ code: 'invalid-password', team })
        else passwords[team] = value
    }

    if (errors.length > 0) return { ok: false, errors }

    const systemDirectory = systemDirectoryOf(input.installPath)
    const iniContent = applyIniOverrides(input.mainIni, camIniOverrides(input.mainIni, input.fps, input.volume))
    const userIniContent = applyIniOverrides(input.userIni, CAM_USER_INI_OVERRIDES)
    const cams = CAM_SLOTS.map((slot): CamPlanCam => {
        const team = teamOf(slot)
        const discordId = discordIds[slot] ?? ''
        const server = servers[team] ?? ''
        const files = camFilesFor(slot)
        const joinOptions = joinOptionsFor(discordId)
        const url = connectUrl(server, joinOptions, passwords[team] ?? '')
        return {
            slot,
            team,
            discordId,
            server,
            windowTitle: CAM_WINDOW_TITLES[slot],
            joinOptions,
            url,
            files,
            iniContent,
            userIniContent,
            command: {
                executable: `${systemDirectory}\\${GAME_EXECUTABLE}`,
                workingDirectory: systemDirectory,
                args: [url, '-NewWindow', `INI=${files.ini}`, `USERINI=${files.userIni}`, `LOG=${files.log}`],
            },
        }
    })
    return { ok: true, plan: { cams } }
}
