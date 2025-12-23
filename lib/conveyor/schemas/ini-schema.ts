import { z } from 'zod'

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
            z.string().describe('Value to write'),
            z.boolean().optional().describe('If true, creates the file if it does not exist'),
        ]),
        return: z.void(),
    },
    readIniSection: {
        args: z.tuple([
            z.string().describe('Path to the INI file (relative to UT99 System folder or absolute)'),
            z.string().describe('Section name'),
        ]),
        return: z.any().optional().describe('The entire section as a key-value pair, or undefined if not found'),
    },
} as const
