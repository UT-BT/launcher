import { z } from 'zod'

export const gameIpcSchema = {
    launchGame: {
        args: z.tuple([
            z.string().min(1), // ip
            z.number().int().positive(), // port
        ]),
        return: z.void(),
    },
    launchGameStandalone: {
        args: z.tuple([]),
        return: z.void(),
    },
    fetchServers: {
        args: z.tuple([]),
        return: z.array(z.any()),
    },
    pingServer: {
        args: z.tuple([
            z.string().refine(ip => {
                const octets = ip.split('.');
                if (octets.length !== 4) return false;
                return octets.every(octet => {
                    const n = Number(octet);
                    return /^\d+$/.test(octet) && n >= 0 && n <= 255;
                });
            }, { message: "Invalid IPv4 address" })
        ]),
        return: z.number(),
    },
    validateCurrentInstallation: {
        args: z.tuple([]),
        return: z.object({
            valid: z.boolean(),
            version: z.string().optional(),
        }),
    },
    isGameRunning: {
        args: z.tuple([]),
        return: z.boolean(),
    },
}
