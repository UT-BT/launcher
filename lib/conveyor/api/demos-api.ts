import { ConveyorApi } from '@/lib/preload/shared'

export class DemosApi extends ConveyorApi {
    saveToSystem = (filename: string, bytes: Uint8Array<ArrayBuffer>) =>
        this.invoke('saveDemoToSystem', filename, bytes)
}
