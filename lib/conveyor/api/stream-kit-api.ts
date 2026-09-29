import { ConveyorApi } from '@/lib/preload/shared'
import type { CamRequest, KitExtractRequest } from '@/lib/conveyor/schemas/stream-kit-schema'
import type { CamSlot } from '@/lib/stream-kit/cam-plan'

export class StreamKitApi extends ConveyorApi {
    planCams = (request: CamRequest) => this.invoke('planCams', request)
    launchCams = (request: CamRequest) => this.invoke('launchCams', request)
    retitleCams = () => this.invoke('retitleCams')
    getCamStatus = () => this.invoke('getCamStatus')
    restartCam = (slot: CamSlot, request: CamRequest | null = null) => this.invoke('restartCam', slot, request)
    stopCams = () => this.invoke('stopCams')
    extractKit = (request: KitExtractRequest) => this.invoke('extractStreamKit', request)
}
