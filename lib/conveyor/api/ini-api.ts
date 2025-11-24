import { ConveyorApi } from '@/lib/preload/shared'

export class IniApi extends ConveyorApi {
    readIniValue = (path: string, section: string, key: string) => this.invoke('readIniValue', path, section, key)
    writeIniValue = (path: string, section: string, key: string, value: string) => this.invoke('writeIniValue', path, section, key, value)
    readIniSection = (path: string, section: string) => this.invoke('readIniSection', path, section)
}
