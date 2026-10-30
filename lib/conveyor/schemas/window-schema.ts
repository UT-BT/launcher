import { z } from 'zod'

export const windowIpcSchema = {
  'window-init': {
    args: z.tuple([]),
    return: z.object({
      width: z.number(),
      height: z.number(),
      minimizable: z.boolean(),
      maximizable: z.boolean(),
      platform: z.string(),
    }),
  },
  'window-minimize': {
    args: z.tuple([]),
    return: z.void(),
  },
  'window-close': {
    args: z.tuple([]),
    return: z.void(),
  },
  'window-maximize-toggle': {
    args: z.tuple([]),
    return: z.void(),
  },
  'web-open-url': {
    args: z.tuple([z.string()]),
    return: z.void(),
  },
}
