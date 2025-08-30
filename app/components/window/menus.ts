import type { TitlebarMenu } from '@/app/components/window/TitlebarMenu'
import { FaDiscord, FaPatreon, FaTwitch, FaYoutube } from 'react-icons/fa'
import { BiWorld } from 'react-icons/bi'

const viewMenu: TitlebarMenu = {
  name: 'View',
  items: [
    { name: 'Reload', action: 'web-reload', shortcut: 'Ctrl+R' },
    { name: 'Force Reload', action: 'web-force-reload', shortcut: 'Ctrl+Shift+R' },
    { name: 'Toggle Developer Tools', action: 'web-toggle-devtools', shortcut: 'Ctrl+Shift+I' },
    { name: '---' },
    { name: 'Actual Size', action: 'web-actual-size', shortcut: 'Ctrl+0' },
    { name: 'Zoom In', action: 'web-zoom-in', shortcut: 'Ctrl++' },
    { name: 'Zoom Out', action: 'web-zoom-out', shortcut: 'Ctrl+-' },
    { name: '---' },
    { name: 'Toggle Fullscreen', action: 'web-toggle-fullscreen', shortcut: 'F11' },
    { name: 'Maximize', action: 'window-maximize-toggle' },
  ],
}

export const menuItems: TitlebarMenu[] = [
  {
    name: 'File',
    items: [
      {
        name: 'Quit',
        action: 'window-close',
      },
    ],
  },
  ...(import.meta.env.DEV ? [viewMenu] as TitlebarMenu[] : []),
  {
    name: 'Links',
    items: [
      {
        name: 'Website',
        action: 'web-open-url',
        actionParams: ['https://utbt.net'],
        icon: BiWorld,
      },
      {
        name: 'Discord',
        action: 'web-open-url',
        actionParams: ['https://discord.gg/utbt'],
        icon: FaDiscord,
      },
      {
        name: 'Patreon',
        action: 'web-open-url',
        actionParams: ['https://patreon.com/utbt'],
        icon: FaPatreon,
      },
      {
        name: 'YouTube',
        action: 'web-open-url',
        actionParams: ['https://youtube.com/@UTBTnet'],
        icon: FaYoutube,
      },
      {
        name: 'Twitch',
        action: 'web-open-url',
        actionParams: ['https://twitch.tv/utbt'],
        icon: FaTwitch,
      },
    ],
  },
  {
    name: 'About',
    items: [
      {
        name: 'UTBT Launcher',
        actionCallback: () => {
          const context = document.getElementById('titlebar-context')
          if (context) {
            const event = new CustomEvent('toggle-app-info')
            context.dispatchEvent(event)
          }
        },
      },
    ],
  },
]
