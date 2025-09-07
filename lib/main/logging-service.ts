import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'fs'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: string
  data?: any
}

export class LoggingService {
  private logFilePath: string
  private initialized: boolean = false

  constructor() {
    const userDataPath = app.getPath('userData')
    const logsDir = join(userDataPath, 'logs')
    this.logFilePath = join(logsDir, 'utbt.log')

    this.initializeLogFile()
  }

  private initializeLogFile(): void {
    try {
      const logsDir = join(app.getPath('userData'), 'logs')

      if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true })
      }

      const header = `UTBT Launcher | ${new Date().toISOString()}\n${'='.repeat(40)}\n\n`
      writeFileSync(this.logFilePath, header, 'utf-8')

      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize logging:', error)
      this.initialized = false
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString()
    const level = entry.level.toUpperCase().padEnd(5)
    const context = entry.context ? `[${entry.context}] ` : ''
    const data = entry.data ? `\nData: ${JSON.stringify(entry.data, null, 2)}` : ''

    return `${timestamp} ${level} ${context}${entry.message}${data}\n`
  }

  log(level: LogLevel, message: string, context?: string, data?: any): void {
    if (!this.initialized) {
      console.warn('Logging service not initialized')
      return
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data
    }

    const formattedEntry = this.formatLogEntry(entry)

    try {
      appendFileSync(this.logFilePath, formattedEntry, 'utf-8')
    } catch (error) {
      console.error('Failed to write to log file:', error)
    }

    if (level === 'error') {
      console.error(`[${level.toUpperCase()}] ${context ? `[${context}] ` : ''}${message}`, data || '')
    } else if (level === 'warn') {
      console.warn(`[${level.toUpperCase()}] ${context ? `[${context}] ` : ''}${message}`, data || '')
    }
  }

  info(message: string, context?: string, data?: any): void {
    this.log('info', message, context, data)
  }

  warn(message: string, context?: string, data?: any): void {
    this.log('warn', message, context, data)
  }

  error(message: string, context?: string, data?: any): void {
    this.log('error', message, context, data)
  }

  debug(message: string, context?: string, data?: any): void {
    this.log('debug', message, context, data)
  }

  getLogFilePath(): string {
    return this.logFilePath
  }

  getRecentLogs(lines: number = 100): string[] {
    if (!this.initialized) return []

    try {
      const content = readFileSync(this.logFilePath, 'utf-8')
      const allLines = content.split('\n').filter(line => line.trim())
      return allLines.slice(-lines)
    } catch (error) {
      console.error('Failed to read log file:', error)
      return []
    }
  }
}

export const loggingService = new LoggingService()
