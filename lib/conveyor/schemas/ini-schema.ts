import { z } from 'zod'

const iniSection = z.record(z.string(), z.union([z.string(), z.array(z.string())]))

export const iniIpcSchema = {
    readIniValue: {
        args: z.tuple([
            z.string().describe('Path to the INI file (relative to UT99 System folder or absolute)'),
            z.string().describe('Section name'),
            z.string().describe('Key name'),
        ]),
        return: z.string().optional().describe('The value of the key, or undefined if not found'),
    },
    writeIniValue: {
        args: z.tuple([
            z.string().describe('Path to the INI file (relative to UT99 System folder or absolute)'),
            z.string().describe('Section name'),
            z.string().describe('Key name'),
            z.union([z.string(), z.null()]).describe('Value to write, or null to delete'),
            z.boolean().optional().describe('If true, creates the file if it does not exist'),
        ]),
        return: z.void(),
    },
    readIniSection: {
        args: z.tuple([
            z.string().describe('Path to the INI file (relative to UT99 System folder or absolute)'),
            z.string().describe('Section name'),
        ]),
        return: iniSection.optional().describe('Section keys, duplicate keys as arrays, or undefined if not found'),
    },
} as const
