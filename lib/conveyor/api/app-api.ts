import { ConveyorApi } from '@/lib/preload/shared'

export class AppApi extends ConveyorApi {
  version = () => this.invoke('version')
  getInstallPath = () => this.invoke('getInstallPath')
  setInstallPath = (path: string) => this.invoke('setInstallPath', path)
  selectInstallFolder = () => this.invoke('selectInstallFolder')
  downloadIsos = (installDir: string) => this.invoke('downloadIsos', installDir)
  verifyInstallPath = (path: string) => this.invoke('verifyInstallPath', path)
  startUTInstall = () => this.invoke('startUTInstall')
  pickInstallFolder = () => this.invoke('pickInstallFolder')
  
  // Patches
  getPatchChannel = () => this.invoke('getPatchChannel')
  fetchPatches = () => this.invoke('fetchPatches')
  setPatchChannel = (channel: 'stable' | 'rc') => this.invoke('setPatchChannel', channel)
  getInstalledPatch = () => this.invoke('getInstalledPatch')
  setInstalledPatch = (p: { tag: string; sha256: string; channel: 'stable' | 'rc'; installedAt: string }) => this.invoke('setInstalledPatch', p)
  setBaseVersion = (version: string) => this.invoke('setBaseVersion', version)
  getBaseVersion = () => this.invoke('getBaseVersion')
  fetchLatestPatchManifest = (stableOnly?: boolean) => this.invoke('fetchLatestPatchManifest', stableOnly)
  applyPatchFromManifest = (m: { asset_url: string; sha256: string; tag: string; channel: 'stable' | 'rc' }) => this.invoke('applyPatchFromManifest', m)
  getExeMD5 = (dir: string) => this.invoke('getExeMD5', dir)

  installAnnouncerUax = () => this.invoke('installAnnouncerUax')

  createDesktopShortcut = (installPath: string) => this.invoke('createDesktopShortcut', installPath)
  createStartMenuShortcut = (installPath: string) => this.invoke('createStartMenuShortcut', installPath)

  getGatewayConfig = () => this.invoke('getGatewayConfig')
  setGatewayConfig = (config: { baseUrl?: string; apiKey?: string }) => this.invoke('setGatewayConfig', config)
}
