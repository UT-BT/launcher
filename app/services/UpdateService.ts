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
      await window.logging.info('Getting current version', 'UpdateService')
      const installed = await this.app.getInstalledPatch()
      if (installed?.tag) {
        await window.logging.debug('Found installed patch version', 'UpdateService', { tag: installed.tag })
        return installed.tag
      }

      const base = await this.app.getBaseVersion()
      await window.logging.debug('Using base version', 'UpdateService', { base })
      return base
    } catch (error) {
      await window.logging.error('Failed to resolve current version', 'UpdateService', { error })
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
      await window.logging.info('Checking for updates', 'UpdateService', { channel })

      const installPath = await this.app.getInstallPath()
      if (!installPath) {
        await window.logging.warn('No install path configured, skipping update check', 'UpdateService')
        return { available: false, forced: false }
      }

      const baseVersion = await this.app.getBaseVersion()
      const isUnsupportedBase = baseVersion === 'unsupported'
      await window.logging.debug('Base version check', 'UpdateService', { baseVersion, isUnsupportedBase })

      const manifestResp = await this.app.fetchLatestPatchManifest(
        channel === 'stable' ? true : undefined
      )

      if (!manifestResp?.success || !manifestResp.data) {
        await window.logging.warn('Failed to fetch latest patch manifest', 'UpdateService', { success: manifestResp?.success })
        return { available: false, forced: false }
      }

      const installed = await this.app.getInstalledPatch()
      const needsUpdate = !installed || installed.tag !== manifestResp.data.tag

      await window.logging.debug('Update check results', 'UpdateService', {
        installedTag: installed?.tag,
        latestTag: manifestResp.data.tag,
        needsUpdate
      })

      if (needsUpdate) {
        const manifest: PatchManifest = {
          asset_url: manifestResp.data.asset_url,
          sha256: manifestResp.data.sha256,
          tag: manifestResp.data.tag,
          channel: (manifestResp.data.channel as 'stable' | 'rc') || 'stable',
          release_notes_url: manifestResp.data.release_notes_url,
        }

        const result = {
          available: true,
          manifest,
          forced: !installed || isUnsupportedBase,
          unsupportedBase: isUnsupportedBase
        }

        await window.logging.info('Update available', 'UpdateService', {
          tag: manifest.tag,
          forced: result.forced,
          unsupportedBase: result.unsupportedBase
        })

        return result
      }

      await window.logging.info('No update needed', 'UpdateService', { currentTag: installed?.tag })
      return { available: false, forced: false, unsupportedBase: false }
    } catch (error) {
      await window.logging.error('Failed to check for updates', 'UpdateService', { error })
      return { available: false, forced: false, unsupportedBase: false }
    }
  }

  async applyUpdate(manifest: PatchManifest): Promise<void> {
    try {
      await window.logging.info('Applying update', 'UpdateService', { tag: manifest.tag, channel: manifest.channel })
      await this.app.applyPatchFromManifest(manifest)
      await window.logging.info('Update applied successfully', 'UpdateService', { tag: manifest.tag })
    } catch (error) {
      await window.logging.error('Failed to apply update', 'UpdateService', { error, tag: manifest.tag })
      throw error
    }
  }

  async setupBaseVersion(): Promise<void> {
    try {
      await window.logging.info('Setting up base version', 'UpdateService')
      await this.app.setBaseVersion('v432')
      await window.logging.info('Base version set successfully', 'UpdateService', { version: 'v432' })
    } catch (error) {
      await window.logging.error('Failed to set base version', 'UpdateService', { error })
      throw error
    }
  }

  openReleaseNotes(url?: string): void {
    if (url && window.conveyor?.window?.webOpenUrl) {
      window.logging.info('Opening release notes', 'UpdateService', { url })
      window.conveyor.window.webOpenUrl(url)
    } else {
      window.logging.warn('Cannot open release notes - no URL or webOpenUrl not available', 'UpdateService', { url })
    }
  }
}

export const updateService = UpdateService.getInstance()
