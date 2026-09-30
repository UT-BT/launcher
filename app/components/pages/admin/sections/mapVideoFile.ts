export const MAX_MAP_VIDEO_BYTES = 150 * 1024 * 1024
export const MAP_VIDEO_ACCEPT = '.webm,video/webm'

const MEGABYTE = 1024 * 1024

export interface MapVideoFileInfo {
  name: string
  type: string
  size: number
}

function isWebm(file: MapVideoFileInfo): boolean {
  return file.type === 'video/webm' || file.name.toLowerCase().endsWith('.webm')
}

export function checkMapVideoFile(file: MapVideoFileInfo): string | null {
  if (!isWebm(file)) return 'Map videos must be WebM files. Convert the original to WebM first.'
  if (file.size === 0) return 'That file is empty.'
  if (file.size > MAX_MAP_VIDEO_BYTES) {
    return `That file is ${Math.ceil(file.size / MEGABYTE)} MB. Map videos must be 150 MB or smaller.`
  }
  return null
}
