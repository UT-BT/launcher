import { useState } from 'react'
import { FaUserCog } from 'react-icons/fa'
import { GameProfilesModal } from './GameProfilesModal'

export const GameProfilesButton = () => {
    const [isModalOpen, setIsModalOpen] = useState(false)

    return (
        <>
            <button
                className="titlebar-action-button"
                onClick={() => setIsModalOpen(true)}
                aria-label="Game Profiles"
            >
                <FaUserCog />
            </button>
            <GameProfilesModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
    )
}
