import { ConveyorApi } from '@/lib/preload/shared'

export class GameApi extends ConveyorApi {
    launchGame = (ip: string, port: number) => this.invoke('launchGame', ip, port)
    launchGameStandalone = () => this.invoke('launchGameStandalone')
    fetchServers = () => this.invoke('fetchServers')
    fetchPatrons = () => this.invoke('fetchPatrons')
    pingServer = (ip: string) => this.invoke('pingServer', ip)
    validateCurrentInstallation = () => this.invoke('validateCurrentInstallation')
    isGameRunning = () => this.invoke('isGameRunning')
}
