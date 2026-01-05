import { useState, useEffect } from 'react'
import { Modal } from '@/app/components/ui/modal'
import { fetchTitles, assignTitle, AssignedTitleV2 } from '@/app/utils/api'
import { Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChangeTitleModalProps {
    isOpen: boolean
    onClose: () => void
    accessToken?: string
    userId?: string
    currentTitleId?: string
    onTitleChanged: () => void
}

function getRarityStyles(title: AssignedTitleV2) {
    const { rarity, color_r, color_g, color_b } = title
    const rgb = `rgb(${color_r},${color_g},${color_b})`

    const containerStyle: React.CSSProperties = {}
    const titleStyle: React.CSSProperties = { color: rarity >= 2 ? rgb : undefined }
    let containerClass = ''
    let titleClass = ''

    if (rarity >= 3) {
        containerStyle.borderColor = rgb
    }

    if (rarity >= 4) {
        titleClass = 'animate-pulse-slow'
        titleStyle.textShadow = `0 0 10px ${rgb}`
    }

    if (rarity >= 5) {
        containerClass = 'animate-pulse-slow'
        containerStyle.boxShadow = `0 0 15px ${rgb}`
    }

    return { containerStyle, titleStyle, containerClass, titleClass }
}

export function ChangeTitleModal({ isOpen, onClose, accessToken, userId, currentTitleId, onTitleChanged }: ChangeTitleModalProps) {
    const [titles, setTitles] = useState<AssignedTitleV2[]>([])
    const [loading, setLoading] = useState(false)
    const [assigning, setAssigning] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen && accessToken) {
            loadTitles()
        }
    }, [isOpen, accessToken, userId])

    const loadTitles = async () => {
        if (!accessToken) return
        setLoading(true)
        setError(null)
        try {
            const data = await fetchTitles(accessToken, 100, 0, userId)
            setTitles(data || [])
        } catch (err) {
            console.error('Failed to load titles:', err)
            setError('Failed to load titles')
        } finally {
            setLoading(false)
        }
    }

    const handleSelectTitle = async (title: AssignedTitleV2) => {
        if (!accessToken) return

        if (title.title_id === currentTitleId) {
            onClose()
            return
        }

        setAssigning(title.title_id)
        try {
            await assignTitle(accessToken, title.title_id)
            onTitleChanged()
            onClose()
        } catch (err) {
            console.error('Failed to assign title:', err)
            setError('Failed to update title')
        } finally {
            setAssigning(null)
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Change Title"
            offsetSidebar
            maxWidth="480px"
            className="bg-[#0a0a0b]/98 border-white/5 backdrop-blur-3xl mx-auto"
            footer={null}
        >
            <div className="space-y-4 pb-2">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="size-8 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                        {error}
                    </div>
                ) : titles.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        No titles found.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2">
                        {titles.map((title) => {
                            const styles = getRarityStyles(title)
                            const isSelected = title.title_id === currentTitleId || (title.selected && !currentTitleId) // Fallback to title.selected if currentTitleId not passed correctly, though we should pass it.

                            return (
                                <button
                                    key={title.id}
                                    onClick={() => handleSelectTitle(title)}
                                    disabled={!!assigning}
                                    className={cn(
                                        "relative group flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-all text-left",
                                        isSelected && "bg-white/10 border-white/20",
                                        styles.containerClass
                                    )}
                                    style={styles.containerStyle}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={cn("text-sm font-bold", styles.titleClass)}
                                            style={styles.titleStyle}
                                        >
                                            {title.name}
                                        </div>
                                        {title.rarity >= 1 && (
                                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-black/20 px-1.5 py-0.5 rounded">
                                                Rarity {title.rarity}
                                            </span>
                                        )}
                                    </div>

                                    {isSelected && (
                                        <Check className="size-4 text-emerald-400" />
                                    )}

                                    {assigning === title.title_id && (
                                        <Loader2 className="size-4 animate-spin text-white" />
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </Modal>
    )
}
