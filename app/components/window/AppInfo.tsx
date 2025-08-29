import { useEffect, useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 w-full max-w-[80%] lg:max-w-[60%] xl:max-w-[50%] mx-auto shadow-xl">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold">UTBT Launcher</h2>
            <Badge variant="secondary" className="text-lg px-3 py-1">v{appVersion}</Badge>
          </div>
          
          <div className="space-y-4">
            <p className="text-lg text-gray-600 dark:text-gray-300">
              The UTBT Launcher is a modern game launcher made for the UTBT community to make your lives better 💖
            </p>

            <p className="text-lg text-gray-600 dark:text-gray-300">
              Game installer, auto-updates, and more.
            </p>

            <hr className="my-6 border-gray-200 dark:border-gray-700" />
            
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">License</h3>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                MIT License © {new Date().getFullYear()} UTBT
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Contribute</h3>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                The UTBT Launcher is an open-source project, maintained by the UTBT administrators and moderators. 
              </p>

              <p className="text-lg text-gray-600 dark:text-gray-300">
                You can contribute on{' '}
                    <a
                    href="https://github.com/UT-BT/launcher"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
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

          <div className="flex justify-end mt-8">
            <Button onClick={onClose} size="lg">Close</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
