import { ConveyorApi } from '@/lib/preload/shared'
import type { LogLevel } from '@/lib/main/logging-service'

export class LoggingApi extends ConveyorApi {
  log(level: LogLevel, message: string, context?: string, data?: any): Promise<void> {
    return this.invoke('logMessage', level, message, context, data)
  }

  info(message: string, context?: string, data?: any): Promise<void> {
    return this.log('info', message, context, data)
  }

  warn(message: string, context?: string, data?: any): Promise<void> {
    return this.log('warn', message, context, data)
  }

  error(message: string, context?: string, data?: any): Promise<void> {
    return this.log('error', message, context, data)
  }

  debug(message: string, context?: string, data?: any): Promise<void> {
    return this.log('debug', message, context, data)
  }

  getLogFilePath(): Promise<string> {
    return this.invoke('getLogFilePath')
  }

  getRecentLogs(lines?: number): Promise<string[]> {
    return this.invoke('getRecentLogs', lines)
  }
}
