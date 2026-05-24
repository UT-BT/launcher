import { z } from 'zod'

export const demosIpcSchema = {
    saveDemoToSystem: {
        args: z.tuple([z.string(), z.instanceof(Uint8Array)]),
        return: z.discriminatedUnion('ok', [
            z.object({
                ok: z.literal(true),
                path: z.string(),
                bytes: z.number(),
            }),
            z.object({
                ok: z.literal(false),
                reason: z.string(),
            }),
        ]),
    },
} as const
