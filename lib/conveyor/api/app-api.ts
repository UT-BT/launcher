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
}
