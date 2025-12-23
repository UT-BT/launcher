import { ConveyorApi } from '@/lib/preload/shared'

export class AppApi extends ConveyorApi {
  version = () => this.invoke('version')

  getGatewayConfig = () => this.invoke('getGatewayConfig')
  setGatewayConfig = (config: { baseUrl?: string; apiKey?: string }) => this.invoke('setGatewayConfig', config)

  getDemoWatcherConfig = () => this.invoke('getDemoWatcherConfig')
  setDemoWatcherConfig = (config: {
    autoUpload: 'Never' | 'Personal Bests Only' | 'World Records Only' | 'All Runs',
    postUploadAction: 'Do Nothing' | 'Move to Folder' | 'Delete'
  }) => this.invoke('setDemoWatcherConfig', config)

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
  getUploadLogs = () => this.invoke('getUploadLogs')
  addUploadLog = (entry: {
    filename: string
    status: 'success' | 'failed' | 'uploading'
    timestamp: string
    error?: string
  }) => this.invoke('addUploadLog', entry)
  updateUploadLogStatus = (filename: string, status: 'success' | 'failed', error?: string) =>
    this.invoke('updateUploadLogStatus', filename, status, error)
}
