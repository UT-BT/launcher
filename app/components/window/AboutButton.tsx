import { FaInfoCircle } from 'react-icons/fa'
import { Tooltip } from '@/app/components/ui/tooltip'

interface AboutButtonProps {
  onClick?: () => void
}

export const AboutButton = ({ onClick }: AboutButtonProps = {}) => {
  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      const context = document.getElementById('titlebar-context')
      if (context) {
        const event = new CustomEvent('toggle-app-info')
        context.dispatchEvent(event)
      }
    }
  }

  return (
    <Tooltip content="About" side="bottom">
      <button
        className="titlebar-action-button"
        onClick={handleClick}
        aria-label="About"
      >
        <FaInfoCircle />
      </button>
    </Tooltip>
  )
}
