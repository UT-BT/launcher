import { ConveyorApi } from '@/lib/preload/shared'

export class IniApi extends ConveyorApi {
    readIniValue = (path: string, section: string, key: string) => this.invoke('readIniValue', path, section, key)
    writeIniValue = (path: string, section: string, key: string, value: string | null, createIfMissing?: boolean) => this.invoke('writeIniValue', path, section, key, value, createIfMissing)
    readIniSection = (path: string, section: string) => this.invoke('readIniSection', path, section)
}
