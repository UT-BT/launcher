import { useState } from 'react'
import { FaUserCircle } from 'react-icons/fa'
import { GameProfilesModal } from './GameProfilesModal'
import { Tooltip } from '@/app/components/ui/tooltip'
import { useTitlebarContext } from './TitlebarContext'

export const GameProfilesButton = () => {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const { areButtonsDisabled, isGameProfilesDisabled } = useTitlebarContext()

    const isDisabled = areButtonsDisabled || isGameProfilesDisabled

    return (
        <>
            <Tooltip content="Game Profiles" side="bottom">
                <button
                    className={`titlebar-action-button ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => !isDisabled && setIsModalOpen(true)}
                    aria-label="Game Profiles"
                    disabled={isDisabled}
                >
                    <FaUserCircle />
                </button>
            </Tooltip>
            <GameProfilesModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
    )
}
