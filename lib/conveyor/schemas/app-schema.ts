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
}
