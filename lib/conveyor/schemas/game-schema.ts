import { z } from 'zod'

export const gameIpcSchema = {
    launchGame: {
        args: z.tuple([
            z.string().min(1), // ip
            z.number().int().positive(), // port
            z.string().optional(), // password
        ]),
        return: z.void(),
    },
    fetchServers: {
        args: z.tuple([]),
        return: z.array(z.any()), // Using z.any() for flexibility with backend response
    },
}
