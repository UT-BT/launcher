/// <reference types="electron-vite/node" />

declare const __WEB_TARGET__: boolean
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_GATEWAY_BASE_URL?: string
}

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
    onIsoDownloadProgress: (cb: (data: { progress: number; totalBytes: number; downloadedBytes: number }) => void) => () => void
  }
  utPatch: {
    onStatus: (cb: (data: { status: string; message?: string; tag?: string }) => void) => () => void
    onPatchInstallStatus: (cb: (data: { status: string; tag?: string; message?: string }) => void) => () => void
    onPatchInstallProgress: (cb: (data: { progress: number }) => void) => () => void
    onInstallationPathUpdated: (cb: (data: { version: string }) => void) => () => void
    onAnnouncerInstallProgress: (cb: (data: { progress: number }) => void) => () => void
    onAnnouncerInstallComplete: (cb: () => void) => () => void
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
  auth: {
    login: () => Promise<import('@/lib/main/config').AuthConfig>
    logout: () => Promise<void>
    getProfile: () => Promise<import('@/lib/main/config').AuthConfig | undefined>
  }
  utProfile: {
    onChanged: (cb: () => void) => () => void
  }
  utFavorites: {
    onGameClosed: (cb: () => void) => () => void
  }
  utbtUpdater: {
    onStateChanged: (cb: (state: import('@/lib/conveyor/schemas/updater-schema').UpdaterStateSnapshot) => void) => () => void
  }
  uiScale: {
    set: (factor: number) => void
    get: () => number
  }
}
