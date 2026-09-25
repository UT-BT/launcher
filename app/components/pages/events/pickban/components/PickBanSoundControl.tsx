import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Slider } from '@/app/components/ui/slider'
import { Switch } from '@/app/components/ui/switch'
import type { PickBanSoundPreference } from '../pickBanSoundPreference'
import { SOUND_PACK_IDS, type PickBanSoundPack } from '../pickBanSounds'

interface PickBanSoundControlProps {
    on: boolean
    preference: PickBanSoundPreference
    onToggle: (on: boolean) => void
    onChange: (preference: PickBanSoundPreference) => void
    onPreview: (pack: PickBanSoundPack) => void
    className?: string
}

const PACK_COPY: { [pack in PickBanSoundPack]: { label: string; hint: string } } = {
    cinematic: { label: 'Cinematic', hint: 'Big whooshes, deep impacts, reverb' },
    clean: { label: 'Clean', hint: 'Tight, restrained, premium' },
}

const SMALL_CAPS = 'text-[10px] font-bold uppercase tracking-wider text-muted-foreground'

const ARROW_STEPS: Partial<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

export function PickBanSoundControl({ on, preference, onToggle, onChange, onPreview, className }: PickBanSoundControlProps) {
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const panelId = useId()
    const Icon = on ? Volume2 : VolumeX

    useEffect(() => {
        if (!open) return
        const closeOnOutsidePointer = (event: PointerEvent) => {
            if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
        }
        const closeOnEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key !== 'Escape') return
            const focusInside = rootRef.current?.contains(document.activeElement) ?? false
            setOpen(false)
            if (focusInside) triggerRef.current?.focus()
        }
        document.addEventListener('pointerdown', closeOnOutsidePointer)
        document.addEventListener('keydown', closeOnEscape)
        return () => {
            document.removeEventListener('pointerdown', closeOnOutsidePointer)
            document.removeEventListener('keydown', closeOnEscape)
        }
    }, [open])

    return (
        <div
            ref={rootRef}
            className="relative"
            onBlur={(event) => {
                if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
            }}
        >
            <button
                ref={triggerRef}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen((current) => !current)}
                className={cn(className, 'aria-expanded:border-accent-500/60 aria-expanded:bg-accent-500/25')}
            >
                <Icon className="size-3.5" />
                {on ? 'Sound on' : 'Sound off'}
                <ChevronDown className={cn('size-3.5 opacity-70 transition-transform', open && 'rotate-180')} />
            </button>
            <div
                id={panelId}
                role="group"
                aria-label="Sound settings"
                hidden={!open}
                className="absolute left-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-3 rounded-xl border border-hairline/10 bg-card/95 p-3 shadow-xl shadow-black/30 backdrop-blur-xl"
            >
                <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 sm:min-h-9">
                    <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <Icon className="size-4 text-muted-foreground" />
                        Sound
                    </span>
                    <Switch checked={on} onCheckedChange={onToggle} tabIndex={-1} aria-hidden />
                </label>
                <PackChooser
                    pack={preference.pack}
                    onChoose={(pack) => {
                        onChange({ ...preference, pack })
                        onPreview(pack)
                    }}
                />
                <VolumeField
                    volume={preference.volume}
                    onCommit={(volume) => {
                        onChange({ ...preference, volume })
                        onPreview(preference.pack)
                    }}
                />
                {!on && <p className="text-[11px] text-muted-foreground">Turn sound on to hear a preview.</p>}
            </div>
        </div>
    )
}

function PackChooser({ pack, onChoose }: { pack: PickBanSoundPack; onChoose: (pack: PickBanSoundPack) => void }) {
    const labelId = useId()
    const optionId = useId()
    const radios = useRef<(HTMLButtonElement | null)[]>([])
    const choose = (next: PickBanSoundPack) => {
        if (next !== pack) onChoose(next)
    }
    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const step = ARROW_STEPS[event.key]
        if (step === undefined) return
        event.preventDefault()
        const next = (index + step + SOUND_PACK_IDS.length) % SOUND_PACK_IDS.length
        radios.current[next]?.focus()
        choose(SOUND_PACK_IDS[next])
    }

    return (
        <div className="space-y-1.5">
            <p id={labelId} className={SMALL_CAPS}>Style</p>
            <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-2 gap-1 rounded-lg border border-hairline/10 bg-card/60 p-1">
                {SOUND_PACK_IDS.map((option, index) => {
                    const chosen = option === pack
                    return (
                        <button
                            key={option}
                            ref={(node) => {
                                radios.current[index] = node
                            }}
                            type="button"
                            role="radio"
                            aria-checked={chosen}
                            aria-labelledby={`${optionId}-${option}`}
                            aria-describedby={`${optionId}-${option}-hint`}
                            tabIndex={chosen ? 0 : -1}
                            onClick={() => choose(option)}
                            onKeyDown={(event) => onKeyDown(event, index)}
                            className={cn(
                                'flex min-h-11 min-w-0 cursor-pointer flex-col items-start justify-center gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors sm:min-h-10',
                                chosen ? 'bg-accent-500 text-white shadow-md shadow-accent-500/30' : 'text-muted-foreground hover:bg-hairline/5 hover:text-foreground',
                            )}
                        >
                            <span id={`${optionId}-${option}`} className="text-sm font-bold leading-tight">{PACK_COPY[option].label}</span>
                            <span id={`${optionId}-${option}-hint`} className={cn('text-[11px] leading-snug', chosen ? 'text-white/80' : 'text-muted-foreground')}>
                                {PACK_COPY[option].hint}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

function VolumeField({ volume, onCommit }: { volume: number; onCommit: (volume: number) => void }) {
    const id = useId()
    const [draft, setDraft] = useState<number | null>(null)
    const percent = draft ?? Math.round(volume * 100)
    const commit = () => {
        if (draft === null) return
        setDraft(null)
        onCommit(draft / 100)
    }

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
                <label htmlFor={id} className={SMALL_CAPS}>Volume</label>
                <span aria-hidden className="text-xs font-bold tabular-nums text-foreground">{percent}%</span>
            </div>
            <Slider
                id={id}
                min={0}
                max={100}
                step={1}
                value={percent}
                aria-valuetext={`${percent}%`}
                onChange={(event) => setDraft(Number(event.target.value))}
                onPointerUp={commit}
                onPointerCancel={commit}
                onKeyUp={commit}
                onBlur={commit}
                style={{ backgroundImage: `linear-gradient(to right, var(--accent-500) ${percent}%, var(--secondary) ${percent}%)` }}
                className="h-11 bg-transparent bg-[length:100%_0.375rem] bg-center bg-no-repeat accent-[var(--accent-500)] sm:h-8"
            />
        </div>
    )
}
