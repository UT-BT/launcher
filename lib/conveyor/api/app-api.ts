import { ConveyorApi } from '@/lib/preload/shared'

export class AppApi extends ConveyorApi {
  version = () => this.invoke('version')

  getGatewayConfig = () => this.invoke('getGatewayConfig')
  setGatewayConfig = (config: { baseUrl?: string; apiKey?: string }) => this.invoke('setGatewayConfig', config)

  getUt99InstallPath = () => this.invoke('getUt99InstallPath')
  setUt99InstallPath = (path?: string) => this.invoke('setUt99InstallPath', path)

  getInstalledPatch = () => this.invoke('getInstalledPatch')
  setInstalledPatch = (patch?: { tag: string; sha256: string; installedAt: string }) => this.invoke('setInstalledPatch', patch)

  downloadUt99Iso = () => this.invoke('downloadUt99Iso')
  cancelUt99Download = () => this.invoke('cancelUt99Download')
  mountAndRunUt99Iso = () => this.invoke('mountAndRunUt99Iso')

  selectInstallDirectory = () => this.invoke('selectInstallDirectory')
  validateAndSetInstallPath = (path: string) => this.invoke('validateAndSetInstallPath', path)
  validateCurrentInstallation = () => this.invoke('validateCurrentInstallation')

  fetchPatches = () => this.invoke('fetchPatches')
  installPatch = (patch: any) => this.invoke('installPatch', patch)
}
