import { ConveyorApi } from '@/lib/preload/shared'

export class GameApi extends ConveyorApi {
    launchGame = (ip: string, port: number) => this.invoke('launchGame', ip, port)
    fetchServers = () => this.invoke('fetchServers')
    pingServer = (ip: string) => this.invoke('pingServer', ip)
    validateCurrentInstallation = () => this.invoke('validateCurrentInstallation')
    isGameRunning = () => this.invoke('isGameRunning')
}
