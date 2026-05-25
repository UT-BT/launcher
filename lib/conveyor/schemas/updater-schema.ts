import { z } from 'zod'

const updaterPhaseSchema = z.union([
  z.literal('idle'),
  z.literal('checking'),
  z.literal('not-available'),
  z.literal('available'),
  z.literal('downloading'),
  z.literal('downloaded'),
  z.literal('installing'),
  z.literal('error'),
])

const updaterStateSchema = z.object({
  phase: updaterPhaseSchema,
  version: z.string().optional(),
  releaseNotes: z.string().optional(),
  releaseDate: z.string().optional(),
  progressPercent: z.number().optional(),
  bytesPerSecond: z.number().optional(),
  transferred: z.number().optional(),
  total: z.number().optional(),
  error: z.string().optional(),
  allowPrerelease: z.boolean(),
  currentVersion: z.string(),
  lastCheckTrigger: z.union([z.literal('auto'), z.literal('manual'), z.null()]),
  lastCheckedAt: z.string().optional(),
})

export const updaterIpcSchema = {
  'updater:check': {
    args: z.tuple([z.boolean().optional()]),
    return: z.void(),
  },
  'updater:download': {
    args: z.tuple([]),
    return: z.void(),
  },
  'updater:quitAndInstall': {
    args: z.tuple([]),
    return: z.void(),
  },
  'updater:getState': {
    args: z.tuple([]),
    return: updaterStateSchema,
  },
  'updater:setAllowPrerelease': {
    args: z.tuple([z.boolean()]),
    return: z.void(),
  },
}

export type UpdaterStateSnapshot = z.infer<typeof updaterStateSchema>
