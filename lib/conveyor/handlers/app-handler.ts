import { app, dialog, type BrowserWindow } from 'electron'
import { handle } from '@/lib/main/shared'
import { getUt99InstallPath, setUt99InstallPath } from '@/lib/main/config'
import { join } from 'path'
import { createWriteStream, existsSync, mkdirSync, statSync, readFileSync } from 'fs'
import { createHash } from 'crypto'
import https from 'https'
import { IncomingMessage } from 'http'
import { spawn } from 'child_process'

export const registerAppHandlers = (_window: BrowserWindow) => {
  handle('version', () => app.getVersion())
  handle('getInstallPath', () => getUt99InstallPath())
  handle('setInstallPath', (path: string) => setUt99InstallPath(path))
  handle('selectInstallFolder', () => {
    const paths = dialog.showOpenDialogSync({
      title: 'Select UT99 Installation Folder',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (!paths || paths.length === 0) return undefined
    const selected = paths[0]
    setUt99InstallPath(selected)
    return selected
  })

  const downloadFile = (url: string, destinationFile: string, stage: string) =>
    new Promise<void>((resolve, reject) => {
      const dir = destinationFile.substring(0, destinationFile.lastIndexOf('\\')) || destinationFile.substring(0, destinationFile.lastIndexOf('/'))
      if (dir && !existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      const fileStream = createWriteStream(destinationFile)

      const handleResponse = (response: IncomingMessage) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          https.get(response.headers.location, handleResponse).on('error', (err) => reject(err))
          return
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status ${response.statusCode}`))
          return
        }

        const total = Number(response.headers['content-length'] || 0)
        let downloaded = 0
        response.on('data', (chunk) => {
          downloaded += chunk.length
          if (total > 0) {
            const pct = Math.min(100, Math.round((downloaded / total) * 100))
            try { _window.webContents.send('ut-install-progress', { stage, progress: pct }) } catch { /* ignore */ }
          } else {
            try { _window.webContents.send('ut-install-progress', { stage, progress: Math.min(99, Math.floor(downloaded / (1024 * 1024))) }) } catch { /* ignore */ }
          }
        })

        response.pipe(fileStream)
        fileStream.on('finish', () => fileStream.close(() => {
          try { _window.webContents.send('ut-install-progress', { stage, progress: 100 }) } catch { /* ignore */ }
          resolve()
        }))
      }

      https.get(url, handleResponse).on('error', (err) => reject(err))
    })

  handle('downloadIsos', async (installDir: string) => {
    const cd1 = 'https://archive.org/download/ut-goty/UT_GOTY_CD1.iso'
    const cd2 = 'https://archive.org/download/ut-goty/UT_GOTY_CD2.iso'
    const dest1 = join(installDir, 'UT_GOTY_CD1.iso')
    const dest2 = join(installDir, 'UT_GOTY_CD2.iso')
    await downloadFile(cd1, dest1, 'cd1')
    await downloadFile(cd2, dest2, 'cd2')
  })

  handle('verifyInstallPath', (path: string) => {
    try {
      const exe = join(path, 'System', 'UnrealTournament.exe')
      const st = statSync(exe)
      return st.isFile()
    } catch {
      return false
    }
  })

  handle('pickInstallFolder', () => {
    const paths = dialog.showOpenDialogSync({
      title: 'Select UT99 Installation Folder',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (!paths || paths.length === 0) return undefined
    return paths[0]
  })

  const calculateMD5 = (filePath: string): string => {
    const fileBuffer = readFileSync(filePath)
    const hashSum = createHash('md5')
    hashSum.update(fileBuffer)
    return hashSum.digest('hex')
  }

  const verifyFile = (filePath: string, expectedMD5: string): boolean => {
    if (!existsSync(filePath)) return false
    try {
      const actualMD5 = calculateMD5(filePath)
      return actualMD5 === expectedMD5
    } catch {
      return false
    }
  }

  handle('startUTInstall', async () => {
    const tmp = app.getPath('temp')
    const utTmp = join(tmp, 'utbt-ut99')
    if (!existsSync(utTmp)) mkdirSync(utTmp, { recursive: true })
    
    const cd1 = 'https://archive.org/download/ut-goty/UT_GOTY_CD1.iso'
    const cd2 = 'https://archive.org/download/ut-goty/UT_GOTY_CD2.iso'
    const dest1 = join(utTmp, 'UT_GOTY_CD1.iso')
    const dest2 = join(utTmp, 'UT_GOTY_CD2.iso')
    
    // soupy added hashes, these shouldn't change and should verify the files correctly :)
    const cd1MD5 = 'e5127537f44086f5ed36a9d29f992c00'
    const cd2MD5 = 'b59a097bc6d899018ffbf65401b66231'
    
    if (verifyFile(dest1, cd1MD5)) {
      try { _window.webContents.send('ut-install-progress', { stage: 'cd1', progress: 100 }) } catch { /* ignore */ }
      try { _window.webContents.send('ut-install-status', { status: 'cd1-cached' }) } catch { /* ignore */ }
    } else {
      try { _window.webContents.send('ut-install-status', { status: 'downloading-cd1' }) } catch { /* ignore */ }
      await downloadFile(cd1, dest1, 'cd1')
    }
    
    if (verifyFile(dest2, cd2MD5)) {
      try { _window.webContents.send('ut-install-progress', { stage: 'cd2', progress: 100 }) } catch { /* ignore */ }
      try { _window.webContents.send('ut-install-status', { status: 'cd2-cached' }) } catch { /* ignore */ }
    } else {
      try { _window.webContents.send('ut-install-status', { status: 'downloading-cd2' }) } catch { /* ignore */ }
      await downloadFile(cd2, dest2, 'cd2')
    }

    const runSetupFromIso = async (isoPath: string, cdName: string) => {
      return new Promise<void>((resolve, reject) => {
        const psScript = `
try {
  Write-Host "Mounting ${cdName}..."
  $mount = Mount-DiskImage -ImagePath "${isoPath}" -PassThru
  $volume = $mount | Get-Volume
  $driveLetter = $volume.DriveLetter
  if (-not $driveLetter) {
    throw "Failed to get drive letter for mounted ISO"
  }
  Write-Host "Mounted to drive $driveLetter"
  
  $setupPath = "$driveLetter" + ":\\Setup.exe"
  if (-not (Test-Path $setupPath)) {
    throw "Setup.exe not found at $setupPath"
  }
  
  Write-Host "Running Setup.exe..."
  $process = Start-Process -FilePath $setupPath -Wait -PassThru
  Write-Host "Setup.exe exited with code $($process.ExitCode)"
  
  Write-Host "Unmounting ${cdName}..."
  Dismount-DiskImage -ImagePath "${isoPath}"
  Write-Host "Done with ${cdName}"
} catch {
  Write-Error "Error with ${cdName}: $($_.Exception.Message)"
  try { Dismount-DiskImage -ImagePath "${isoPath}" -ErrorAction SilentlyContinue } catch {}
  exit 1
}`

        const ps = spawn('powershell.exe', [
          '-NoProfile',
          '-ExecutionPolicy', 'Bypass',
          '-Command', psScript
        ], { 
          windowsHide: false,
          stdio: ['pipe', 'pipe', 'pipe']
        })

        let stdout = ''
        let stderr = ''
        
        ps.stdout?.on('data', (data) => {
          stdout += data.toString()
          console.warn(`${cdName} stdout:`, data.toString().trim())
        })
        
        ps.stderr?.on('data', (data) => {
          stderr += data.toString()
          console.error(`${cdName} stderr:`, data.toString().trim())
        })

        ps.on('exit', (code) => {
          console.warn(`${cdName} PowerShell exit code:`, code)
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`${cdName} installation failed with exit code ${code}. Stdout: ${stdout}. Stderr: ${stderr}`))
          }
        })

        ps.on('error', (err) => {
          console.error(`${cdName} PowerShell process error:`, err)
          reject(err)
        })
      })
    }

    try { _window.webContents.send('ut-install-status', { status: 'installing-cd1' }) } catch { /* ignore */ }
    try {
      await runSetupFromIso(dest1, 'CD1')
    } catch (error) {
      console.error('CD1 installation failed:', error)
      try { _window.webContents.send('ut-install-status', { status: 'error', message: `CD1 installation failed: ${error}` }) } catch { /* ignore */ }
      throw error
    }

    try { _window.webContents.send('ut-install-status', { status: 'installing-cd2' }) } catch { /* ignore */ }
    try {
      await runSetupFromIso(dest2, 'CD2')
    } catch (error) {
      console.error('CD2 installation failed:', error)
      try { _window.webContents.send('ut-install-status', { status: 'error', message: `CD2 installation failed: ${error}` }) } catch { /* ignore */ }
      throw error
    }

    try { _window.webContents.send('ut-install-status', { status: 'complete' }) } catch { /* ignore */ }
  })
}
