import { z } from 'zod'

export const mapsIpcSchema = {
    extractMapToInstall: {
        args: z.tuple([z.string(), z.instanceof(Uint8Array)]),
        return: z.discriminatedUnion('ok', [
            z.object({
                ok: z.literal(true),
                installPath: z.string(),
                extracted: z.array(z.string()),
                skipped: z.array(z.string()),
            }),
            z.object({
                ok: z.literal(false),
                reason: z.string(),
            }),
        ]),
    },
} as const
