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
  fetchPatches: {
    args: z.tuple([]),
    return: z.any(),
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
  setInstalledPatch: {
    args: z.tuple([
      z.object({ tag: z.string(), sha256: z.string(), channel: z.union([z.literal('stable'), z.literal('rc')]), installedAt: z.string() })
    ]),
    return: z.void(),
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
  
  getExeMD5: {
    args: z.tuple([z.string().min(1)]),
    return: z.string().optional(),
  },
  applyPatchFromManifest: {
    args: z.tuple([z.object({ asset_url: z.string().url(), sha256: z.string(), tag: z.string(), channel: z.union([z.literal('stable'), z.literal('rc')]) })]),
    return: z.void(),
  },

  installAnnouncerUax: {
    args: z.tuple([]),
    return: z.void(),
  },

  createDesktopShortcut: {
    args: z.tuple([z.string().min(1)]),
    return: z.void(),
  },
  createStartMenuShortcut: {
    args: z.tuple([z.string().min(1)]),
    return: z.void(),
  },

  getGatewayConfig: {
    args: z.tuple([]),
    return: z.object({
      baseUrl: z.string(),
      apiKey: z.string().optional(),
    }),
  },
  setGatewayConfig: {
    args: z.tuple([z.object({
      baseUrl: z.string().optional(),
      apiKey: z.string().optional(),
    })]),
    return: z.void(),
  },

  logMessage: {
    args: z.tuple([
      z.union([z.literal('info'), z.literal('warn'), z.literal('error'), z.literal('debug')]),
      z.string(),
      z.string().optional(),
      z.any().optional(),
    ]),
    return: z.void(),
  },
  getLogFilePath: {
    args: z.tuple([]),
    return: z.string(),
  },
  getRecentLogs: {
    args: z.tuple([z.number().optional()]),
    return: z.array(z.string()),
  },
}
