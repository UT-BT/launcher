// Core application types
export type InstallationStatus = 'idle' | 'downloading' | 'installing' | 'done' | 'error'

export type PatchChannel = 'stable' | 'rc'

export interface PatchManifest {
  asset_url: string
  sha256: string
  tag: string
  channel: PatchChannel
  release_notes_url?: string
}

export interface InstallationProgress {
  stage: 'cd1' | 'cd2' | 'patch'
  progress: number
  totalBytes?: number
  downloadedBytes?: number
  speed?: number
  eta?: number
}

export interface InstallationConfig {
  installPath?: string
  patchChannel: PatchChannel
}

export interface InstallationState {
  status: InstallationStatus
  progress: number
  progressText: string
  speedText: string
  etaText: string
  error?: string
}

export interface UpdateState {
  available: boolean
  manifest?: PatchManifest
  currentVersion?: string
  updating: boolean
  progress: number
  progressText: string
  forced: boolean
  unsupportedBase?: boolean
}

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export interface ConfirmModalProps extends ModalProps {
  onConfirm: () => void
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
}

export interface InstallationEvents {
  onProgress: (data: { stage: string; progress: number }) => void
  onStatus: (data: { status: string; message?: string }) => void
  onConfirm: (data: { id: string; title: string; message: string; detail?: string }) => void
}

export interface PatchEvents {
  onStatus: (data: { status: string; message?: string; tag?: string }) => void
}

export interface GatewayConfig {
  baseUrl: string
  apiKey?: string
}