import { InstallationConfig, PatchManifest } from '@/app/types'
import { useConveyor } from '@/app/hooks/use-conveyor'

export class InstallationService {
  private static instance: InstallationService
  private app: ReturnType<typeof useConveyor<'app'>>
  private window: ReturnType<typeof useConveyor<'window'>>

  // Installation constants
  public readonly SIZE_CD1 = 619.5 * 1024 * 1024
  public readonly SIZE_CD2 = 557.3 * 1024 * 1024
  public readonly TOTAL_SIZE = this.SIZE_CD1 + this.SIZE_CD2

  private constructor() {
    this.app = window.conveyor.app
    this.window = window.conveyor.window
  }

  public static getInstance(): InstallationService {
    if (!InstallationService.instance) {
      InstallationService.instance = new InstallationService()
    }
    return InstallationService.instance
  }

  async getInstallConfig(): Promise<InstallationConfig> {
    try {
      const [installPath, patchChannel] = await Promise.all([
        this.app.getInstallPath(),
        this.app.getPatchChannel()
      ])
      
      return {
        installPath: installPath || undefined,
        patchChannel
      }
    } catch (error) {
      console.error('Failed to load install config:', error)
      return { patchChannel: 'stable' }
    }
  }

  async setInstallPath(path: string): Promise<boolean> {
    try {
      const isValid = await this.app.verifyInstallPath(path)
      if (isValid) {
        await this.app.setInstallPath(path)
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to set install path:', error)
      return false
    }
  }

  async setPatchChannel(channel: 'stable' | 'rc'): Promise<void> {
    try {
      await this.app.setPatchChannel(channel)
    } catch (error) {
      console.error('Failed to set patch channel:', error)
    }
  }

  async pickInstallFolder(): Promise<string | null> {
    try {
      const sel = await this.app.pickInstallFolder()
      return sel ?? null
    } catch (error) {
      console.error('Failed to pick install folder:', error)
      return null
    }
  }

  async startInstallation(): Promise<void> {
    try {
      await this.app.startUTInstall()
    } catch (error) {
      console.error('Installation failed:', error)
      throw error
    }
  }

  async applyPatch(manifest: PatchManifest): Promise<void> {
    try {
      await this.app.applyPatchFromManifest(manifest)
    } catch (error) {
      console.error('Patch application failed:', error)
      throw error
    }
  }

  async installAnnouncer(): Promise<void> {
    try {
      await this.app.installAnnouncerUax()
    } catch (error) {
      console.error('Announcer installation failed:', error)
      throw error
    }
  }

  calculateCombinedProgress(cd1Progress: number, cd2Progress: number): number {
    const downloadedBytes = (cd1Progress / 100 * this.SIZE_CD1) + (cd2Progress / 100 * this.SIZE_CD2)
    return Math.min(100, Math.max(0, Math.round((downloadedBytes / this.TOTAL_SIZE) * 100)))
  }

  formatSpeed(bytesPerSec: number): string {
    if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return ''
    const mbps = bytesPerSec / (1024 * 1024)
    if (mbps >= 1) return `${mbps.toFixed(1)} MB/s`
    const kbps = bytesPerSec / 1024
    return `${kbps.toFixed(0)} kB/s`
  }

  formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return ''
    const sec = Math.max(0, Math.round(seconds))
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const rem = sec % 60
    if (h > 0) return `${h}h ${m}m ${rem}s`
    if (m > 0) return `${m}m ${rem}s`
    return `${rem}s`
  }

  async setWindowLocked(locked: boolean): Promise<void> {
    try {
      await this.window.webSetLocked(locked)
      const ctx = document.getElementById('titlebar-context')
      if (ctx) {
        ctx.dispatchEvent(new CustomEvent('set-titlebar-lock', { detail: { locked } }))
      }
    } catch (error) {
      console.error('Failed to set window lock:', error)
    }
  }
}

export const installationService = InstallationService.getInstance()
