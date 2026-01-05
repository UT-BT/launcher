import { FaCog } from 'react-icons/fa'
import { Tooltip } from '@/app/components/ui/tooltip'

export const SettingsButton = () => {
    const handleClick = () => {
        window.dispatchEvent(new CustomEvent('open-settings'))
    }

    return (
        <Tooltip content="Settings" side="bottom">
            <button
                className="titlebar-action-button"
                onClick={handleClick}
                aria-label="Settings"
            >
                <FaCog />
            </button>
        </Tooltip>
    )
}
