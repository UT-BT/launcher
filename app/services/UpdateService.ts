import { PatchManifest } from '@/app/types'
import { useConveyor } from '@/app/hooks/use-conveyor'

export class UpdateService {
  private static instance: UpdateService
  private app: ReturnType<typeof useConveyor<'app'>>

  private constructor() {
    this.app = window.conveyor.app
  }

  public static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService()
    }
    return UpdateService.instance
  }

  async getCurrentVersion(): Promise<string | undefined> {
    try {
      const installed = await this.app.getInstalledPatch()
      if (installed?.tag) {
        return installed.tag
      }
      
      const base = await this.app.getBaseVersion()
      return base
    } catch (error) {
      console.warn('Failed to resolve current version:', error)
      return undefined
    }
  }

  async checkForUpdates(channel?: 'stable' | 'rc'): Promise<{
    available: boolean
    manifest?: PatchManifest
    forced: boolean
    unsupportedBase?: boolean
  }> {
    try {
      const installPath = await this.app.getInstallPath()
      if (!installPath) {
        return { available: false, forced: false }
      }

      const baseVersion = await this.app.getBaseVersion()
      const isUnsupportedBase = baseVersion === 'unsupported'

      const manifestResp = await this.app.fetchLatestPatchManifest(
        channel === 'stable' ? true : undefined
      )

      if (!manifestResp?.success || !manifestResp.data) {
        return { available: false, forced: false }
      }

      const installed = await this.app.getInstalledPatch()
      const needsUpdate = !installed || installed.tag !== manifestResp.data.tag

      if (needsUpdate) {
        const manifest: PatchManifest = {
          asset_url: manifestResp.data.asset_url,
          sha256: manifestResp.data.sha256,
          tag: manifestResp.data.tag,
          channel: (manifestResp.data.channel as 'stable' | 'rc') || 'stable',
          release_notes_url: manifestResp.data.release_notes_url,
        }

        return {
          available: true,
          manifest,
          forced: !installed || isUnsupportedBase,
          unsupportedBase: isUnsupportedBase
        }
      }

      return { available: false, forced: false, unsupportedBase: false }
    } catch (error) {
      console.error('Failed to check for updates:', error)
      return { available: false, forced: false, unsupportedBase: false }
    }
  }

  async applyUpdate(manifest: PatchManifest): Promise<void> {
    try {
      await this.app.applyPatchFromManifest(manifest)
    } catch (error) {
      console.error('Failed to apply update:', error)
      throw error
    }
  }

  async setupBaseVersion(): Promise<void> {
    try {
      await this.app.setBaseVersion('v432')
    } catch (error) {
      console.error('Failed to set base version:', error)
      throw error
    }
  }

  openReleaseNotes(url?: string): void {
    if (url && window.conveyor?.window?.webOpenUrl) {
      window.conveyor.window.webOpenUrl(url)
    }
  }
}

export const updateService = UpdateService.getInstance()
