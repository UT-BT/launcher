import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function electronBinaryPresent() {
  try {
    const binaryPath = require('electron')
    return typeof binaryPath === 'string' && existsSync(binaryPath)
  } catch {
    return false
  }
}

if (electronBinaryPresent()) {
  process.exit(0)
}

console.log('Electron binary missing — reinstalling…')
execFileSync(process.execPath, [require.resolve('electron/install.js')], {
  stdio: 'inherit'
})
