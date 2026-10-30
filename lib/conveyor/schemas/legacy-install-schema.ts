import { z } from 'zod'

const legacyInstallStatusSchema = z.union([
  z.object({ found: z.literal(false) }),
  z.object({ found: z.literal(true), uninstallerName: z.string(), offer: z.boolean() }),
])

const legacyRemovalResultSchema = z.union([
  z.object({ outcome: z.literal('removed'), pinLost: z.boolean() }),
  z.object({ outcome: z.union([z.literal('declined'), z.literal('failed'), z.literal('gone')]) }),
])

export const legacyInstallIpcSchema = {
  'legacyInstall:getStatus': {
    args: z.tuple([]),
    return: legacyInstallStatusSchema,
  },
  'legacyInstall:dismiss': {
    args: z.tuple([]),
    return: z.void(),
  },
  'legacyInstall:remove': {
    args: z.tuple([]),
    return: legacyRemovalResultSchema,
  },
}

export type LegacyInstallStatus = z.infer<typeof legacyInstallStatusSchema>
export type LegacyRemovalResult = z.infer<typeof legacyRemovalResultSchema>
