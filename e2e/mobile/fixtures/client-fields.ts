import { readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'

const APP_DIR = join(__dirname, '..', '..', '..', 'app')
const SOURCE = /\.(ts|tsx)$/
const SKIPPED = [/\.test\.tsx?$/, new RegExp(`\\${sep}pages\\${sep}admin\\${sep}`)]

function sourceFiles(folder: string): string[] {
    return readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
        const path = join(folder, entry.name)
        if (entry.isDirectory()) return sourceFiles(path)
        return SOURCE.test(entry.name) && !SKIPPED.some(pattern => pattern.test(path)) ? [path] : []
    })
}

export function publicClientFields(): Set<string> {
    const fields = new Set<string>()
    for (const file of sourceFiles(APP_DIR)) {
        for (const match of readFileSync(file, 'utf8').matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) fields.add(match[0])
    }
    return fields
}
