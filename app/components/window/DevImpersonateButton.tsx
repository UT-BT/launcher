import { FaUserSecret } from 'react-icons/fa'
import { Tooltip } from '@/app/components/ui/tooltip'
import { DEV_IMPERSONATE_EVENT } from '@/app/utils/devImpersonation'

export const DevImpersonateButton = () => {
    const handleClick = () => {
        window.dispatchEvent(new CustomEvent(DEV_IMPERSONATE_EVENT))
    }

    return (
        <Tooltip content="Impersonate User (dev only)" side="bottom">
            <button
                className="titlebar-action-button"
                onClick={handleClick}
                aria-label="Impersonate User"
            >
                <FaUserSecret />
            </button>
        </Tooltip>
    )
}
