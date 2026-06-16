import { useState, useEffect, useCallback, useMemo } from 'react'
import { Modal } from '@/app/components/ui/modal'
import { fetchTitles, assignTitle, AssignedTitleV2, ActiveTitle } from '@/app/utils/api'
import { getTitleTextStyle } from '@/app/utils/titleStyles'
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

function toActiveTitle(t: AssignedTitleV2): ActiveTitle {
    return {
        name: t.name,
        rarity: t.rarity as ActiveTitle['rarity'],
        color_r: t.color_r,
        color_g: t.color_g,
        color_b: t.color_b,
    }
}

function TitleRow({ label, titleStyle, selected, assigning, disabled, onSelect }: {
    label: string
    titleStyle?: React.CSSProperties
    selected: boolean
    assigning: boolean
    disabled: boolean
    onSelect: () => void
}) {
    return (
        <button
            onClick={onSelect}
            disabled={disabled}
            className={cn(
                "group flex items-center justify-between gap-3 px-4 py-3 rounded-lg border text-left transition-colors",
                "bg-card/40 border-white/5",
                !disabled && "cursor-pointer hover:bg-card/80 hover:border-white/20",
                selected && "bg-accent-500/15 border-accent-500/40",
                selected && !disabled && "hover:bg-accent-500/20 hover:border-accent-500/50",
                disabled && "cursor-not-allowed opacity-60",
            )}
        >
            <span
                className={cn("text-sm font-semibold truncate", !titleStyle && "text-muted-foreground")}
                style={titleStyle}
            >
                {label}
            </span>

            <span className="shrink-0 flex items-center">
                {assigning ? (
                    <Loader2 className="size-4 animate-spin text-accent-300" />
                ) : selected ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-accent-300">
                        <Check className="size-3.5" />
                        Selected
                    </span>
                ) : null}
            </span>
        </button>
    )
}

export function ChangeTitleModal({ isOpen, onClose, accessToken, userId, currentTitleId, onTitleChanged }: ChangeTitleModalProps) {
    const [titles, setTitles] = useState<AssignedTitleV2[]>([])
    const [loading, setLoading] = useState(false)
    const [assigning, setAssigning] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const loadTitles = useCallback(async () => {
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
    }, [accessToken, userId])

    useEffect(() => {
        if (isOpen && accessToken) {
            loadTitles()
        }
    }, [isOpen, accessToken, loadTitles])

    const sortedTitles = useMemo(
        () => [...titles].sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name)),
        [titles]
    )

    const handleSelectTitle = async (title: AssignedTitleV2 | null) => {
        if (!accessToken) return

        const titleId = title?.title_id || null

        if (titleId === (currentTitleId || null)) {
            onClose()
            return
        }

        setAssigning(titleId || 'none')
        try {
            await assignTitle(accessToken, titleId)
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
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
            ) : error ? (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm">
                    {error}
                </div>
            ) : (
                <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                        Pick the title shown next to your name across UTBT.
                    </p>

                    <div className="flex flex-col gap-2">
                        {sortedTitles.map((title) => (
                            <TitleRow
                                key={title.id}
                                label={title.name}
                                titleStyle={getTitleTextStyle(toActiveTitle(title))}
                                selected={title.title_id === currentTitleId}
                                assigning={assigning === title.title_id}
                                disabled={!!assigning}
                                onSelect={() => handleSelectTitle(title)}
                            />
                        ))}

                        {sortedTitles.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground text-xs italic">
                                You don't have any titles yet.
                            </div>
                        )}

                        <TitleRow
                            label="No Title"
                            selected={!currentTitleId}
                            assigning={assigning === 'none'}
                            disabled={!!assigning}
                            onSelect={() => handleSelectTitle(null)}
                        />
                    </div>
                </div>
            )}
        </Modal>
    )
}
