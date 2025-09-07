import { useCallback } from 'react'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface Logger {
  log: (level: LogLevel, message: string, data?: any) => Promise<void>
  info: (message: string, data?: any) => Promise<void>
  warn: (message: string, data?: any) => Promise<void>
  error: (message: string, data?: any) => Promise<void>
  debug: (message: string, data?: any) => Promise<void>
}

/**
 * React hook for logging with a specific context
 * @param context - The context identifier for the logger (e.g., component name)
 * @returns Logger instance with methods to log messages
 */
export function useLogger(context: string): Logger {
  const log = useCallback(async (level: LogLevel, message: string, data?: any) => {
    try {
      if (window.logging) {
        await window.logging.log(level, message, context, data)
      }
    } catch (error) {
      console.error('Failed to log message:', error)
    }
  }, [context])

  const info = useCallback(async (message: string, data?: any) => {
    await log('info', message, data)
  }, [log])

  const warn = useCallback(async (message: string, data?: any) => {
    await log('warn', message, data)
  }, [log])

  const error = useCallback(async (message: string, data?: any) => {
    await log('error', message, data)
  }, [log])

  const debug = useCallback(async (message: string, data?: any) => {
    await log('debug', message, data)
  }, [log])

  return {
    log,
    info,
    warn,
    error,
    debug,
  }
}

/**
 * Hook for getting logging utility functions
 * @returns Object with logging utility functions
 */
export function useLoggingUtils() {
  const getLogFilePath = useCallback(async (): Promise<string> => {
    try {
      if (window.logging) {
        return await window.logging.getLogFilePath()
      }
      return 'Logging API not available'
    } catch (error) {
      console.error('Failed to get log file path:', error)
      return 'Error retrieving log file path'
    }
  }, [])

  const getRecentLogs = useCallback(async (lines: number = 50): Promise<string[]> => {
    try {
      if (window.logging) {
        return await window.logging.getRecentLogs(lines)
      }
      return ['Logging API not available']
    } catch (error) {
      console.error('Failed to get recent logs:', error)
      return [`Error retrieving logs: ${error}`]
    }
  }, [])

  return {
    getLogFilePath,
    getRecentLogs,
  }
}
