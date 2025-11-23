import { z } from 'zod'

export const gameIpcSchema = {
    launchGame: {
        args: z.tuple([
            z.string().min(1), // ip
            z.number().int().positive(), // port
            z.string().optional(), // password
            z.boolean().optional(), // asSpectator
        ]),
        return: z.void(),
    },
    fetchServers: {
        args: z.tuple([]),
        return: z.array(z.any()), // Using z.any() for flexibility with backend response
    },
    pingServer: {
        args: z.tuple([z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)]),
        return: z.number(),
    },
}
