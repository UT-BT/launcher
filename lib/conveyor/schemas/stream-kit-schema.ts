import { z } from 'zod'

const camSlot = z.enum(['A1', 'A2', 'B1', 'B2'])
const camTeam = z.enum(['A', 'B'])
const iniFile = z.enum(['main', 'user'])
const lineupValue = z.string().max(64).nullable().optional()
const serverValue = z.string().max(260).nullable().optional()

export const camRequestSchema = z.object({
    lineup: z.object({ A1: lineupValue, A2: lineupValue, B1: lineupValue, B2: lineupValue }),
    servers: z.object({ A: serverValue, B: serverValue }),
})

const camToolError = z.discriminatedUnion('code', [
    z.object({ code: z.literal('missing-install-path') }),
    z.object({ code: z.literal('missing-ini'), file: iniFile }),
    z.object({ code: z.literal('missing-slot'), slot: camSlot }),
    z.object({ code: z.literal('invalid-discord-id'), slot: camSlot, value: z.string() }),
    z.object({ code: z.literal('missing-server'), team: camTeam }),
    z.object({ code: z.literal('invalid-server'), team: camTeam, value: z.string() }),
    z.object({ code: z.literal('unsupported-platform') }),
    z.object({ code: z.literal('no-install') }),
    z.object({ code: z.literal('ini-unreadable'), file: iniFile }),
    z.object({ code: z.literal('missing-executable') }),
    z.object({ code: z.literal('write-failed'), slot: camSlot }),
    z.object({ code: z.literal('not-launched'), slot: camSlot }),
])

const camPlanSummary = z.object({
    slot: camSlot,
    team: camTeam,
    discordId: z.string(),
    server: z.string(),
    windowTitle: z.string(),
    url: z.string(),
    files: z.object({ ini: z.string(), userIni: z.string(), log: z.string() }),
    command: z.object({ executable: z.string(), workingDirectory: z.string(), args: z.array(z.string()) }),
})

const camStatus = z.object({
    slot: camSlot,
    windowTitle: z.string(),
    running: z.boolean(),
    pid: z.number().int().nullable(),
    titled: z.boolean(),
    server: z.string().nullable(),
    target: z.string().nullable(),
    plannedServer: z.string().nullable(),
    startedAt: z.string().nullable(),
    exitCode: z.number().int().nullable(),
    error: z.string().nullable(),
})

export const camToolStatusSchema = z.object({
    supported: z.boolean(),
    retitle: z.object({ available: z.boolean(), error: z.string().nullable() }),
    cams: z.array(camStatus),
})

const camFailure = z.object({ ok: z.literal(false), errors: z.array(camToolError) })

const camActionResponse = z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), status: camToolStatusSchema }),
    camFailure,
])

export const kitExtractRequestSchema = z.object({
    url: z.string().max(2048),
    token: z.string().max(8192),
    folder: z.string().max(260),
})

const kitExtractFailure = z.enum([
    'unsupported-platform',
    'empty',
    'not-absolute',
    'traversal',
    'invalid-characters',
    'drive-root',
    'invalid-url',
    'missing-token',
    'unauthorized',
    'forbidden',
    'not-found',
    'download-failed',
    'too-large',
    'invalid-zip',
    'zip-slip',
    'extract-error',
])

export const kitProgressSchema = z.object({
    phase: z.enum(['downloading', 'extracting']),
    done: z.number(),
    total: z.number().nullable(),
})

export type CamRequest = z.infer<typeof camRequestSchema>
export type CamToolStatus = z.infer<typeof camToolStatusSchema>
export type KitExtractRequest = z.infer<typeof kitExtractRequestSchema>
export type KitProgress = z.infer<typeof kitProgressSchema>

export const streamKitIpcSchema = {
    planCams: {
        args: z.tuple([camRequestSchema]),
        return: z.discriminatedUnion('ok', [
            z.object({ ok: z.literal(true), cams: z.array(camPlanSummary) }),
            camFailure,
        ]),
    },
    launchCams: {
        args: z.tuple([camRequestSchema]),
        return: camActionResponse,
    },
    retitleCams: {
        args: z.tuple([]),
        return: camToolStatusSchema,
    },
    getCamStatus: {
        args: z.tuple([]),
        return: camToolStatusSchema,
    },
    restartCam: {
        args: z.tuple([camSlot, camRequestSchema.nullable()]),
        return: camActionResponse,
    },
    stopCams: {
        args: z.tuple([]),
        return: camToolStatusSchema,
    },
    extractStreamKit: {
        args: z.tuple([kitExtractRequestSchema]),
        return: z.discriminatedUnion('ok', [
            z.object({ ok: z.literal(true), folder: z.string(), files: z.array(z.string()) }),
            z.object({ ok: z.literal(false), reason: kitExtractFailure, status: z.number().int().optional() }),
        ]),
    },
} as const
