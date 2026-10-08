import { MAP_ARCHIVE_MAX_BYTES, MAP_ARCHIVE_MAX_LABEL, isAbortError, mapUploadErrorMessage } from '@/app/utils/api'

export const ARCHIVE_EXTENSIONS = ['.zip', '.rar', '.7z'] as const
export const ARCHIVE_ACCEPT = ARCHIVE_EXTENSIONS.join(',')

export function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; fileName: string; loaded: number; total: number }
  | { phase: 'done'; fileName: string; draftIds: number[] }
  | { phase: 'error'; fileName: string; message: string }

export type UploadEvent =
  | { type: 'start'; fileName: string; size: number }
  | { type: 'rejected'; fileName: string; message: string }
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'succeeded'; draftIds: number[] }
  | { type: 'failed'; error: unknown }
  | { type: 'cancel' }
  | { type: 'reset' }

export type UploadOutcome = { kind: 'open'; draftId: number } | { kind: 'list'; draftIds: number[] }

export const UPLOAD_IDLE: UploadState = { phase: 'idle' }

export function archiveProblem(file: { name: string; size: number }): string | null {
  const name = file.name.toLowerCase()
  if (!ARCHIVE_EXTENSIONS.some((ext) => name.endsWith(ext) && name.length > ext.length)) return 'Choose a .zip, .rar or .7z archive.'
  if (file.size === 0) return 'This file is empty.'
  if (file.size > MAP_ARCHIVE_MAX_BYTES) return `This archive is ${megabytes(file.size)}, over the ${MAP_ARCHIVE_MAX_LABEL} limit.`
  return null
}

export function uploadReducer(state: UploadState, event: UploadEvent): UploadState {
  if (state.phase === 'uploading') {
    switch (event.type) {
      case 'progress':
        return { ...state, loaded: event.loaded, total: event.total > 0 ? event.total : state.total }
      case 'succeeded':
        return { phase: 'done', fileName: state.fileName, draftIds: event.draftIds }
      case 'failed':
        return isAbortError(event.error) ? UPLOAD_IDLE : { phase: 'error', fileName: state.fileName, message: mapUploadErrorMessage(event.error) }
      case 'cancel':
        return UPLOAD_IDLE
      default:
        return state
    }
  }
  switch (event.type) {
    case 'start':
      return { phase: 'uploading', fileName: event.fileName, loaded: 0, total: event.size }
    case 'rejected':
      return { phase: 'error', fileName: event.fileName, message: event.message }
    case 'reset':
      return UPLOAD_IDLE
    default:
      return state
  }
}

export function uploadPercent(state: UploadState): number {
  if (state.phase === 'done') return 100
  if (state.phase !== 'uploading' || state.total <= 0) return 0
  return Math.min(100, Math.floor((state.loaded * 100) / state.total))
}

export function uploadOutcome(draftIds: number[]): UploadOutcome {
  return draftIds.length === 1 ? { kind: 'open', draftId: draftIds[0] } : { kind: 'list', draftIds }
}
