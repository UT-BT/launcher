import { ConveyorApi } from '@/lib/preload/shared'

export class MapsApi extends ConveyorApi {
    extractToInstall = (mapName: string, bytes: Uint8Array<ArrayBuffer>) =>
        this.invoke('extractMapToInstall', mapName, bytes)
}
