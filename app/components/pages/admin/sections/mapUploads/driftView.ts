import type { DriftRow } from '@/app/utils/mapUploadTypes'

export function filterDriftRows(rows: DriftRow[], query: string): DriftRow[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return rows
  return rows.filter((row) => row.file.toLowerCase().includes(needle))
}

export function shortSha(sha256: string): string {
  return sha256.slice(0, 12)
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
