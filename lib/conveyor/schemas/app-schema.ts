import { z } from 'zod'

export const appIpcSchema = {
  version: {
    args: z.tuple([]),
    return: z.string(),
  },
  getInstallPath: {
    args: z.tuple([]),
    return: z.string().optional(),
  },
  setInstallPath: {
    args: z.tuple([z.string().min(1)]),
    return: z.void(),
  },
  selectInstallFolder: {
    args: z.tuple([]),
    return: z.string().optional(),
  },
  downloadIsos: {
    args: z.tuple([z.string().min(1)]),
    return: z.void(),
  },
  verifyInstallPath: {
    args: z.tuple([z.string().min(1)]),
    return: z.boolean(),
  },
  startUTInstall: {
    args: z.tuple([]),
    return: z.void(),
  },
  pickInstallFolder: {
    args: z.tuple([]),
    return: z.string().optional(),
  },
  
  // Patches
  getPatchChannel: {
    args: z.tuple([]),
    return: z.union([z.literal('stable'), z.literal('rc')]),
  },
  setPatchChannel: {
    args: z.tuple([z.union([z.literal('stable'), z.literal('rc')])]),
    return: z.void(),
  },
  getInstalledPatch: {
    args: z.tuple([]),
    return: z
      .object({ tag: z.string(), sha256: z.string(), channel: z.union([z.literal('stable'), z.literal('rc')]), installedAt: z.string() })
      .optional(),
  },
  setBaseVersion: {
    args: z.tuple([z.string().min(1)]),
    return: z.void(),
  },
  getBaseVersion: {
    args: z.tuple([]),
    return: z.string().optional(),
  },
  fetchLatestPatchManifest: {
    args: z.tuple([z.boolean().optional()]),
    return: z.object({
      success: z.boolean(),
      data: z
        .object({
          added: z.string(),
          asset_name: z.string(),
          asset_url: z.string().url(),
          channel: z.union([z.literal('stable'), z.literal('rc')]),
          id: z.number(),
          release_notes_url: z.string().url(),
          sha256: z.string(),
          tag: z.string(),
        })
        .optional(),
    }),
  },
  applyPatchFromManifest: {
    args: z.tuple([z.object({ asset_url: z.string().url(), sha256: z.string(), tag: z.string(), channel: z.union([z.literal('stable'), z.literal('rc')]) })]),
    return: z.void(),
  },
}
