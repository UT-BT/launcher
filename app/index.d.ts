/// <reference types="electron-vite/node" />

declare module '*.css' {
  const content: string
  export default content
}

declare module '*.png' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}

declare module '*.jpeg' {
  const content: string
  export default content
}

declare module '*.svg' {
  const content: string
  export default content
}

declare module '*.web' {
  const content: string
  export default content
}

interface Window {
  conveyor: import('@/lib/conveyor/api').ConveyorApi
  utInstall: {
    onProgress: (cb: (data: { stage?: string; progress?: number }) => void) => () => void
    onStatus: (cb: (data: { status: string }) => void) => () => void
    onConfirm: (cb: (data: { id: string; title: string; message: string; detail?: string }) => void) => () => void
    respondConfirm: (id: string, accepted: boolean) => void
  }
  utPatch: {
    onStatus: (cb: (data: { status: string; message?: string; tag?: string }) => void) => () => void
  }
  logging: {
    log: (level: string, message: string, context?: string, data?: any) => Promise<void>
    info: (message: string, context?: string, data?: any) => Promise<void>
    warn: (message: string, context?: string, data?: any) => Promise<void>
    error: (message: string, context?: string, data?: any) => Promise<void>
    debug: (message: string, context?: string, data?: any) => Promise<void>
    getLogFilePath: () => Promise<string>
    getRecentLogs: (lines?: number) => Promise<string[]>
  }
}
