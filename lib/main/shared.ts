import { ipcMain } from 'electron'
import { ipcSchemas, validateArgs, validateReturn, type ChannelArgs, type ChannelReturn } from '@/lib/conveyor/schemas'
import { loggingService } from '@/lib/main/logging-service'

/**
 * Helper to register IPC handlers
 * @param channel - The IPC channel to register the handler for
 * @param handler - The handler function to register
 * @returns void
 */
export const handle = <T extends keyof typeof ipcSchemas>(
  channel: T,
  handler: (
    ...args: ChannelArgs<T>
  ) => ChannelReturn<T> | Promise<ChannelReturn<T>>
) => {
  ipcMain.handle(channel, async (_, ...args) => {
    try {
      const validatedArgs = validateArgs(channel, args)
      const result = await handler(...validatedArgs)

      return validateReturn(channel, result)
    } catch (error) {
      loggingService.error(`IPC Error in ${channel}`, 'IPC', error)
      throw error
    }
  })
}
