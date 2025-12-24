import { useState } from 'react'
import { FaUserCircle } from 'react-icons/fa'
import { GameProfilesModal } from './GameProfilesModal'
import { Tooltip } from '@/app/components/ui/tooltip'

export const GameProfilesButton = () => {
    const [isModalOpen, setIsModalOpen] = useState(false)

    return (
        <>
            <Tooltip content="Game Profiles" side="bottom">
                <button
                    className="titlebar-action-button"
                    onClick={() => setIsModalOpen(true)}
                    aria-label="Game Profiles"
                >
                    <FaUserCircle />
                </button>
            </Tooltip>
            <GameProfilesModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
    )
}
