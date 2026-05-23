import { z } from 'zod'

export const favoritesIpcSchema = {
    writeFavoritesIni: {
        args: z.tuple([z.array(z.string())]),
        return: z.object({
            ok: z.boolean(),
            reason: z.string().optional(),
        }),
    },
    readFavoritesIni: {
        args: z.tuple([]),
        return: z.object({
            ok: z.boolean(),
            reason: z.string().optional(),
            mapNames: z.array(z.string()),
        }),
    },
} as const
