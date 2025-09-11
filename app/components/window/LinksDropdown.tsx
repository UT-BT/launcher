import { useState, useRef, useEffect } from 'react'
import { FaDiscord, FaPatreon, FaTwitch, FaYoutube, FaLink } from 'react-icons/fa'
import { BiWorld } from 'react-icons/bi'
import { useConveyor } from '@/app/hooks/use-conveyor'

const links = [
  {
    name: 'Website',
    url: 'https://utbt.net',
    icon: BiWorld,
  },
  {
    name: 'Discord',
    url: 'https://discord.gg/utbt',
    icon: FaDiscord,
  },
  {
    name: 'Patreon',
    url: 'https://patreon.com/utbt',
    icon: FaPatreon,
  },
  {
    name: 'YouTube',
    url: 'https://youtube.com/@UTBTnet',
    icon: FaYoutube,
  },
  {
    name: 'Twitch',
    url: 'https://twitch.tv/utbt',
    icon: FaTwitch,
  },
]

export const LinksDropdown = () => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { invoke } = useConveyor('window')

  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsOpen(false)
    }
  }

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLinkClick = (url: string) => {
    invoke('web-open-url', url)
    setIsOpen(false)
  }

  return (
    <div className="titlebar-dropdown align-left" ref={dropdownRef}>
      <button
        className="titlebar-action-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Links"
      >
        <FaLink />
      </button>

      {isOpen && (
        <div className="titlebar-dropdown-menu">
          {links.map((link, index) => (
            <button
              key={index}
              className="titlebar-dropdown-item"
              onClick={() => handleLinkClick(link.url)}
            >
              <link.icon className="titlebar-dropdown-icon" />
              <span>{link.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
