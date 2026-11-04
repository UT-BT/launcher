export interface MapDownloadSuccess {
    mapName: string
    installPath: string
    extracted: string[]
    skipped: string[]
}

export interface MapDownloadSuccessCopy {
    title: string
    summary: string | null
    lines: string[]
    installPath: string | null
}

function fileCount(count: number): string {
    return `${count} file${count === 1 ? '' : 's'}`
}

export function mapDownloadSuccessCopy(success: MapDownloadSuccess, installsToGame: boolean): MapDownloadSuccessCopy {
    if (!installsToGame) {
        return {
            title: 'Map Downloaded',
            summary: `Downloaded as ${success.mapName}.zip. Unzip it into your UT99 folder to play it.`,
            lines: [],
            installPath: null,
        }
    }
    const lines = [`Extracted: ${fileCount(success.extracted.length)}`]
    if (success.skipped.length > 0) lines.push(`Skipped (already existed): ${fileCount(success.skipped.length)}`)
    return {
        title: 'Map Installed',
        summary: null,
        lines,
        installPath: success.installPath,
    }
}
