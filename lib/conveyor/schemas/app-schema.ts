import { z } from 'zod'

export const appIpcSchema = {
  version: {
    args: z.tuple([]),
    return: z.string(),
  },
  getOSInfo: {
    args: z.tuple([]),
    return: z.object({
      platform: z.string(),
      release: z.string(),
      arch: z.string(),
    }),
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

  getDemoWatcherConfig: {
    args: z.tuple([]),
    return: z.object({
      autoUpload: z.union([z.literal('Never'), z.literal('Personal Bests Only'), z.literal('World Records Only'), z.literal('All Runs')]),
      postUploadAction: z.union([z.literal('Do Nothing'), z.literal('Move to Folder'), z.literal('Delete')]),
    }),
  },
  setDemoWatcherConfig: {
    args: z.tuple([z.object({
      autoUpload: z.union([z.literal('Never'), z.literal('Personal Bests Only'), z.literal('World Records Only'), z.literal('All Runs')]),
      postUploadAction: z.union([z.literal('Do Nothing'), z.literal('Move to Folder'), z.literal('Delete')]),
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
  getUt99InstallPath: {
    args: z.tuple([]),
    return: z.string().optional(),
  },
  setUt99InstallPath: {
    args: z.tuple([z.string().optional()]),
    return: z.void(),
  },
  getInstalledPatch: {
    args: z.tuple([]),
    return: z.object({
      tag: z.string(),
      sha256: z.string(),
      installedAt: z.string(),
    }).optional(),
  },
  setInstalledPatch: {
    args: z.tuple([z.object({
      tag: z.string(),
      sha256: z.string(),
      installedAt: z.string(),
    }).optional()]),
    return: z.void(),
  },
  downloadUt99Iso: {
    args: z.tuple([]),
    return: z.void(),
  },
  cancelUt99Download: {
    args: z.tuple([]),
    return: z.void(),
  },
  mountAndRunUt99Iso: {
    args: z.tuple([]),
    return: z.void(),
  },
  selectInstallDirectory: {
    args: z.tuple([]),
    return: z.string().optional(),
  },
  validateAndSetInstallPath: {
    args: z.tuple([z.string()]),
    return: z.object({
      success: z.boolean(),
      error: z.string().optional(),
      version: z.string().optional(),
    }),
  },
  validateCurrentInstallation: {
    args: z.tuple([]),
    return: z.object({
      valid: z.boolean(),
      version: z.string().optional(),
    }),
  },
  fetchPatches: {
    args: z.tuple([]),
    return: z.array(z.object({
      active: z.boolean(),
      tag: z.string(),
      exe_md5: z.string(),
      sha256: z.string(),
      asset_url: z.string(),
      asset_name: z.string(),
      release_notes_url: z.string(),
      channel: z.string(),
    })),
  },
  installPatch: {
    args: z.tuple([z.object({
      active: z.boolean(),
      tag: z.string(),
      exe_md5: z.string(),
      sha256: z.string(),
      asset_url: z.string(),
      asset_name: z.string(),
      release_notes_url: z.string(),
      channel: z.string(),
    })]),
    return: z.void(),
  },
  getUploadLogs: {
    args: z.tuple([]),
    return: z.array(z.object({
      filename: z.string(),
      status: z.union([z.literal('success'), z.literal('failed'), z.literal('uploading')]),
      timestamp: z.string(),
      error: z.string().optional(),
      attempt: z.number().optional(),
      maxAttempts: z.number().optional(),
    })),
  },
  addUploadLog: {
    args: z.tuple([z.object({
      filename: z.string(),
      status: z.union([z.literal('success'), z.literal('failed'), z.literal('uploading')]),
      timestamp: z.string(),
      error: z.string().optional(),
      attempt: z.number().optional(),
      maxAttempts: z.number().optional(),
    })]),
    return: z.void(),
  },
  updateUploadLogStatus: {
    args: z.tuple([z.string(), z.union([z.literal('success'), z.literal('failed')]), z.string().optional()]),
    return: z.void(),
  },
  createProfile: {
    args: z.tuple([z.string(), z.string()]),
    return: z.void(),
  },
  getProfiles: {
    args: z.tuple([]),
    return: z.array(z.object({
      name: z.string(),
      modifiedAt: z.string(),
    })),
  },
  switchProfile: {
    args: z.tuple([z.string()]),
    return: z.void(),
  },
  deleteProfile: {
    args: z.tuple([z.string()]),
    return: z.void(),
  },
  renameProfile: {
    args: z.tuple([z.string(), z.string()]),
    return: z.void(),
  },
  getActiveProfile: {
    args: z.tuple([]),
    return: z.string().optional(),
  },
  checkProfileSync: {
    args: z.tuple([z.string()]),
    return: z.boolean(),
  },
  extractBtpogId: {
    args: z.tuple([z.string()]),
    return: z.string(),
  },
}
