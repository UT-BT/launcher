import { app, dialog, type BrowserWindow, ipcMain } from 'electron'
import { handle } from '@/lib/main/shared'
import { getUt99InstallPath, setUt99InstallPath, getPatchChannel, setPatchChannel, getInstalledPatch, setInstalledPatch, setBaseVersion, markFreshInstall, getBaseVersion, getGatewayConfig, setGatewayConfig } from '@/lib/main/config'
import { gatewayService } from '@/lib/main/gateway-service'
import { loggingService } from '@/lib/main/logging-service'
import { join } from 'path'
import { createWriteStream, existsSync, mkdirSync, statSync, readFileSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import https from 'https'
import { IncomingMessage } from 'http'
import { spawn } from 'child_process'

export const registerAppHandlers = (_window: BrowserWindow) => {
  loggingService.info('Registering app IPC handlers', 'MainProcess')

  handle('version', () => {
    const version = app.getVersion()
    loggingService.debug('Version requested', 'MainProcess', { version })
    return version
  })
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

  handle('getPatchChannel', () => getPatchChannel())
  handle('fetchPatches', async () => {
    try {
      const result = await gatewayService.get('/patches', true)
      return result
    } catch {
      return { success: false }
    }
  })
  handle('setPatchChannel', (channel: 'stable' | 'rc') => setPatchChannel(channel))
  handle('getInstalledPatch', () => getInstalledPatch())
  handle('setInstalledPatch', (patch: { tag: string; sha256: string; channel: 'stable' | 'rc'; installedAt: string }) => setInstalledPatch(patch))
  handle('setBaseVersion', (version: string) => setBaseVersion(version))
  handle('getBaseVersion', () => getBaseVersion())

  handle('getGatewayConfig', () => getGatewayConfig())
  handle('setGatewayConfig', (config: { baseUrl?: string; apiKey?: string }) => setGatewayConfig(config))

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

  handle('getExeMD5', (dir: string) => {
    try {
      const exe = join(dir, 'System', 'UnrealTournament.exe')
      if (!existsSync(exe)) return undefined
      const buf = readFileSync(exe)
      const md5 = createHash('md5').update(buf).digest('hex')
      return md5
    } catch (err) {
      console.warn('getExeMD5 failed:', err)
      return undefined
    }
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

    try {
      const confirmId = Math.random().toString(36).slice(2)
      try {
        _window.webContents.send('ut-install-confirm', {
          id: confirmId,
          title: 'Install Optional CD2 Assets?',
          detail:
            'CD2 contains optional S3TC high-resolution textures.\n\nThis increases disk usage but improves texture quality on supported renderers.\n\nDo you want to download and install CD2 now?',
        })
      } catch { /* ignore */ }

      const installCd2: boolean = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          try { ipcMain.removeListener('ut-install-confirm-response', onResponse) } catch { /* ignore */ }
          resolve(false)
        }, 120000)

        const onResponse = (_event: unknown, data: { id?: string; accepted?: boolean }) => {
          if (!data || data.id !== confirmId) return
          clearTimeout(timeout)
          try { ipcMain.removeListener('ut-install-confirm-response', onResponse) } catch { /* ignore */ }
          resolve(Boolean(data.accepted))
        }

        ipcMain.on('ut-install-confirm-response', onResponse)
      })

      if (installCd2) {
        if (verifyFile(dest2, cd2MD5)) {
          try { _window.webContents.send('ut-install-progress', { stage: 'cd2', progress: 100 }) } catch { /* ignore */ }
          try { _window.webContents.send('ut-install-status', { status: 'cd2-cached' }) } catch { /* ignore */ }
        } else {
          try { _window.webContents.send('ut-install-status', { status: 'downloading-cd2' }) } catch { /* ignore */ }
          await downloadFile(cd2, dest2, 'cd2')
        }

        try { _window.webContents.send('ut-install-status', { status: 'installing-cd2' }) } catch { /* ignore */ }
        try {
          await runSetupFromIso(dest2, 'CD2')
        } catch (error) {
          console.error('CD2 installation failed:', error)
          try { _window.webContents.send('ut-install-status', { status: 'error', message: `CD2 installation failed: ${error}` }) } catch { /* ignore */ }
          throw error
        }
      }
    } catch (err) {
      console.warn('CD2 prompt failed, skipping CD2:', err)
    }

    try {
      markFreshInstall('v432')
    } catch (err) {
      console.warn('Failed to mark fresh install:', err)
    }
    try { _window.webContents.send('ut-install-status', { status: 'complete' }) } catch { /* ignore */ }
  })



  handle('fetchLatestPatchManifest', async (stableOnly?: boolean) => {
    const channel = stableOnly === true ? 'stable' : getPatchChannel()
    const endpoint = channel === 'stable' ? '/patches/latest?stable=true' : '/patches/latest'
    try {
      const result = await gatewayService.get(endpoint, true)
      return result
    } catch {
      return { success: false }
    }
  })

  const calculateSHA256 = (filePath: string): string => {
    const fileBuffer = readFileSync(filePath)
    const hashSum = createHash('sha256')
    hashSum.update(fileBuffer)
    return hashSum.digest('hex')
  }

  handle('applyPatchFromManifest', async (m: { asset_url: string; sha256: string; tag: string; channel: 'stable' | 'rc' }) => {
    const installPath = getUt99InstallPath()
    if (!installPath) throw new Error('Install path not set')

    const tmpDir = join(app.getPath('temp'), 'utbt-patches')
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true })
    const fileName = m.asset_url.split('/').pop() || `patch-${m.tag}.zip`
    const dest = join(tmpDir, fileName)

    try { _window.webContents.send('ut-patch-status', { status: 'downloading', tag: m.tag }) } catch (err) { console.warn('patch status send failed', err) }
    await downloadFile(m.asset_url, dest, 'patch')

    const actual = calculateSHA256(dest)
    if (actual.toLowerCase() !== m.sha256.toLowerCase()) {
      try { _window.webContents.send('ut-patch-status', { status: 'error', message: 'SHA256 mismatch' }) } catch (err) { console.warn('patch status send failed', err) }
      throw new Error('SHA256 mismatch')
    }

    try { _window.webContents.send('ut-patch-status', { status: 'verifying', tag: m.tag }) } catch (err) { console.warn('patch status send failed', err) }

    try { _window.webContents.send('ut-patch-status', { status: 'applying', tag: m.tag }) } catch (err) { console.warn('patch status send failed', err) }
    await new Promise<void>((resolve, reject) => {
      const escapePs = (s: string) => s.replace(/`/g, '``').replace(/"/g, '`"')
      const zipEsc = escapePs(dest)
      const destEsc = escapePs(installPath)
      const psScript = `
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath "${zipEsc}")) { exit 2 }
Expand-Archive -LiteralPath "${zipEsc}" -DestinationPath "${destEsc}" -Force
`
      const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], {
        windowsHide: true,
      })
      ps.on('exit', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`Expand-Archive failed: ${code}`))
      })
      ps.on('error', reject)
    })

    try {
      const stamp = { tag: m.tag, sha256: m.sha256, channel: m.channel, installedAt: new Date().toISOString() }
      writeFileSync(join(installPath, '.utbt-installed-patch.json'), JSON.stringify(stamp, null, 2), 'utf-8')
      setInstalledPatch(stamp)
    } catch (err) {
      console.warn('Failed writing installed patch stamp:', err)
    }

    try { _window.webContents.send('ut-patch-status', { status: 'complete', tag: m.tag }) } catch (err) { console.warn('patch status send failed', err) }
  })

  handle('installAnnouncerUax', async () => {
    const installPath = getUt99InstallPath()
    if (!installPath) throw new Error('Install path not set')

    const soundsDir = join(installPath, 'Sounds')
    const announcerUrl = `${getGatewayConfig().baseUrl.replace(/\/$/, '')}/assets/ut/Announcer.uax`
    const destFile = join(soundsDir, 'Announcer.uax')

    try { _window.webContents.send('ut-install-progress', { stage: 'announcer', progress: 0 }) } catch { /* ignore */ }

    await new Promise<void>((resolve, reject) => {
      const dir = soundsDir
      if (!existsSync(dir)) {
        try { mkdirSync(dir, { recursive: true }) } catch (err) { return reject(err) }
      }
      const fileStream = createWriteStream(destFile)

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
            try { _window.webContents.send('ut-install-progress', { stage: 'announcer', progress: pct }) } catch { /* ignore */ }
          }
        })

        response.pipe(fileStream)
        fileStream.on('finish', () => fileStream.close(() => {
          try { _window.webContents.send('ut-install-progress', { stage: 'announcer', progress: 100 }) } catch { /* ignore */ }
          resolve()
        }))
      }

      https.get(announcerUrl, handleResponse).on('error', (err) => reject(err))
    })
    try { _window.webContents.send('ut-install-status', { status: 'announcer-complete' }) } catch { /* ignore */ }
  })

  handle('createDesktopShortcut', async (installPath: string) => {
    const exePath = join(installPath, 'System', 'UnrealTournament.exe')
    const desktopPath = app.getPath('desktop')
    const shortcutPath = join(desktopPath, 'Unreal Tournament 1999.lnk')

    const psScript = `
$ErrorActionPreference = 'Stop'
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("${shortcutPath.replace(/\\/g, '\\\\')}")
$Shortcut.TargetPath = "${exePath.replace(/\\/g, '\\\\')}"
$Shortcut.WorkingDirectory = "${installPath.replace(/\\/g, '\\\\')}"
$Shortcut.IconLocation = "${exePath.replace(/\\/g, '\\\\')},0"
$Shortcut.Description = "Unreal Tournament 1999"
$Shortcut.Save()
`

    return new Promise<void>((resolve, reject) => {
      const ps = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-Command', psScript
      ], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      ps.on('exit', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`Desktop shortcut creation failed with exit code ${code}`))
        }
      })

      ps.on('error', (err) => {
        console.error('Desktop shortcut creation error:', err)
        reject(err)
      })
    })
  })

  handle('createStartMenuShortcut', async (installPath: string) => {
    const exePath = join(installPath, 'System', 'UnrealTournament.exe')
    const startMenuPath = join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
    const utFolder = join(startMenuPath, 'Unreal Tournament 1999')
    const shortcutPath = join(utFolder, 'Unreal Tournament 1999.lnk')

    const psScript = `
$ErrorActionPreference = 'Stop'
if (-not (Test-Path "${utFolder.replace(/\\/g, '\\\\')}")) {
  New-Item -ItemType Directory -Path "${utFolder.replace(/\\/g, '\\\\')}" -Force | Out-Null
}
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("${shortcutPath.replace(/\\/g, '\\\\')}")
$Shortcut.TargetPath = "${exePath.replace(/\\/g, '\\\\')}"
$Shortcut.WorkingDirectory = "${installPath.replace(/\\/g, '\\\\')}"
$Shortcut.IconLocation = "${exePath.replace(/\\/g, '\\\\')},0"
$Shortcut.Description = "Unreal Tournament 1999"
$Shortcut.Save()
`

    return new Promise<void>((resolve, reject) => {
      const ps = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-Command', psScript
      ], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      ps.on('exit', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`Start Menu shortcut creation failed with exit code ${code}`))
        }
      })

      ps.on('error', (err) => {
        console.error('Start Menu shortcut creation error:', err)
        reject(err)
      })
    })
  })

  handle('logMessage', (level: 'info' | 'warn' | 'error' | 'debug', message: string, context?: string, data?: any) => {
    loggingService.log(level, message, context, data)
  })

  handle('getLogFilePath', () => {
    const logPath = loggingService.getLogFilePath()
    loggingService.debug('Log file path requested', 'MainProcess', { logPath })
    return logPath
  })

  handle('getRecentLogs', (lines?: number) => {
    const logs = loggingService.getRecentLogs(lines)
    loggingService.debug('Recent logs requested', 'MainProcess', { lines, count: logs.length })
    return logs
  })
}
