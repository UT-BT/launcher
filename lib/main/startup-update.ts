export type StartupUpdateDeps = {
  check: () => Promise<boolean>
  download: () => Promise<boolean>
  install: () => void
  checkTimeoutMs: number
  downloadTimeoutMs: number
}

export async function runStartupUpdate(deps: StartupUpdateDeps): Promise<boolean> {
  const available = await settleWithin(deps.check, deps.checkTimeoutMs)
  if (!available) return false

  const downloaded = await settleWithin(deps.download, deps.downloadTimeoutMs)
  if (!downloaded) return false

  deps.install()
  return true
}

function settleWithin(work: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs)
    const finish = (value: boolean) => {
      clearTimeout(timer)
      resolve(value)
    }
    work().then(finish, () => finish(false))
  })
}
