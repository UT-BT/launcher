import { FaInfo } from 'react-icons/fa'

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
    <button
      className="titlebar-action-button"
      onClick={handleClick}
      aria-label="About"
    >
      <FaInfo />
    </button>
  )
}
