import { useEffect, useState } from 'react'
import { Badge } from '@/app/components/ui/badge'
import { Modal } from '@/app/components/ui/modal'

interface AppInfoProps {
  onClose: () => void
}

export function AppInfo({ onClose }: AppInfoProps) {
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    window.conveyor.app.version().then((version) => {
      setAppVersion(version)
    })
  }, [])

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="UTBT Launcher"
      maxWidth="42rem"
      offsetSidebar
      portal
    >
      <div className="space-y-4 text-sm text-muted-foreground">
        {appVersion && <Badge variant="secondary">v{appVersion}</Badge>}

        <p>
          The UTBT Launcher is a modern game launcher made for the UTBT community to make your lives better 💖
        </p>

        <p>Game installer, auto-updates, and more.</p>

        <div className="space-y-1.5 border-t border-hairline/10 pt-4">
          <h4 className="text-base font-semibold text-foreground">License</h4>
          <p>MIT License © {new Date().getFullYear()} UTBT</p>
        </div>

        <div className="space-y-1.5">
          <h4 className="text-base font-semibold text-foreground">Contribute</h4>
          <p>
            The UTBT Launcher is an open-source project, maintained by the UTBT administrators and moderators.
          </p>
          <p>
            You can contribute on{' '}
            <a
              href="https://github.com/UT-BT/launcher"
              className="text-accent-400 hover:underline"
              onClick={(e) => {
                e.preventDefault()
                window.conveyor.window.webOpenUrl('https://github.com/UT-BT/launcher')
              }}
            >
              GitHub
            </a>
            .
          </p>
        </div>
      </div>
    </Modal>
  )
}
