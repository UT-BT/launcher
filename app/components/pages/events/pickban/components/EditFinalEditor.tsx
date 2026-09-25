import type { ComponentProps } from 'react'
import { ArrowDown, ArrowUp, Plus, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { displayMapName } from '@/app/utils/format'
import {
    addFinalEntry,
    moveFinalEntry,
    removeFinalEntry,
    setFinalDecider,
    setFinalMap,
    setFinalSide,
    type FinalDraft,
    type FinalEditorRow,
    type FinalMapChoice,
    type FinalSideChoice,
} from '../editFinal'
import type { ManagerFinalEditor } from '../managerDock'
import { Rejection } from './CaptainDock'
import { PICK_BAN_TONES, teamTone } from './pickBanTone'

type ChangeDraft = (change: (draft: FinalDraft) => FinalDraft) => void

interface EditFinalEditorProps {
    editor: ManagerFinalEditor
    resultsWarning: string | null
    onChange: ChangeDraft
    onReload: () => void
    onDismissRejection: () => void
}

const SELECT = 'h-11 w-full min-w-0 cursor-pointer rounded-lg border border-hairline/10 bg-card/50 px-3 text-sm text-foreground focus:border-accent-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 @2xl/final:h-9'

const ICON_BUTTON = 'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-hairline/10 bg-card/50 text-muted-foreground transition-colors hover:border-hairline/20 hover:text-foreground disabled:pointer-events-none disabled:opacity-30 @2xl/final:size-9'

export function EditFinalEditor({ editor, resultsWarning, onChange, onReload, onDismissRejection }: EditFinalEditorProps) {
    return (
        <div className="@container/final flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
                List the maps in the order they’re played, with who picked each. Only the last map can be the decider.
            </p>
            {resultsWarning && (
                <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-300">
                    {resultsWarning}
                </p>
            )}
            {editor.outdated && (
                <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                    <p className="min-w-0 flex-1 basis-56 text-sm font-medium text-amber-300">
                        The final maps changed since you opened the editor. Reload them to edit the current list.
                    </p>
                    <button
                        type="button"
                        onClick={onReload}
                        className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-sm font-medium text-amber-300 transition-colors hover:border-amber-500/50 hover:bg-amber-500/25 @2xl/final:h-8 @2xl/final:text-xs"
                    >
                        <RotateCcw className="size-4" />
                        Reload
                    </button>
                </div>
            )}
            {editor.rejection && <Rejection message={editor.rejection} onDismiss={onDismissRejection} />}
            <ol aria-label="Final maps" className="flex flex-col gap-2">
                {editor.rows.map((row) => (
                    <EditorRow key={row.key} row={row} maps={editor.maps} sides={editor.sides} onChange={onChange} />
                ))}
            </ol>
            <button
                type="button"
                disabled={!editor.canAdd}
                onClick={() => onChange(addFinalEntry)}
                className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-hairline/20 px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-hairline/30 hover:text-foreground disabled:pointer-events-none disabled:opacity-40 @2xl/final:h-9 @2xl/final:self-start @2xl/final:text-xs"
            >
                <Plus className="size-4" />
                Add a map
            </button>
            <ul aria-live="polite" className="space-y-1 text-xs text-red-300">
                {editor.problems.map((problem) => <li key={problem}>{problem}</li>)}
            </ul>
        </div>
    )
}

function EditorRow({ row, maps, sides, onChange }: {
    row: FinalEditorRow
    maps: FinalMapChoice[]
    sides: FinalSideChoice[]
    onChange: ChangeDraft
}) {
    const { key, mapNumber } = row
    const ab = sides.find((choice) => choice.side === row.side)?.ab ?? null
    const tone = PICK_BAN_TONES[row.decider ? 'gold' : teamTone(ab)]
    const unlisted = row.map !== null && !maps.some((choice) => choice.map === row.map) ? row.map : null

    return (
        <li
            className={cn(
                'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border p-2 @2xl/final:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,11rem)_auto_auto] @2xl/final:gap-3',
                row.invalid ? 'border-red-500/40 bg-red-500/5' : 'border-hairline/10 bg-card/50',
            )}
        >
            <span className={cn('text-[10px] font-bold uppercase tracking-wider', tone.text)}>Map {mapNumber}</span>
            <select
                aria-label={`Map ${mapNumber}`}
                value={row.map ?? ''}
                onChange={(event) => {
                    const map = event.target.value
                    onChange((draft) => setFinalMap(draft, key, map || null))
                }}
                style={{ colorScheme: 'dark' }}
                className={cn(SELECT, 'col-span-2 @2xl/final:col-span-1')}
            >
                <option value="" disabled>Choose a map…</option>
                {unlisted !== null && <option value={unlisted} disabled>{displayMapName(unlisted)}</option>}
                {maps.map(({ map, label }) => <option key={map} value={map}>{label}</option>)}
            </select>
            <div className="col-span-2 flex items-center gap-3 @2xl/final:contents">
                <select
                    aria-label={`Who picked map ${mapNumber}`}
                    value={row.side ?? ''}
                    disabled={row.decider}
                    onChange={(event) => {
                        const side = sides.find((choice) => choice.side === event.target.value)?.side ?? null
                        onChange((draft) => setFinalSide(draft, key, side))
                    }}
                    style={{ colorScheme: 'dark' }}
                    className={cn(SELECT, 'flex-1')}
                >
                    <option value="" disabled>{row.decider ? 'No pick: decider' : 'Picked by…'}</option>
                    {sides.map(({ side, name }) => <option key={side} value={side}>{name}</option>)}
                </select>
                <label
                    title={row.canBeDecider ? undefined : 'Only the last map can be the decider'}
                    className={cn(
                        'inline-flex h-11 shrink-0 items-center gap-2 text-sm text-foreground @2xl/final:h-9 @2xl/final:text-xs',
                        row.canBeDecider ? 'cursor-pointer' : 'cursor-not-allowed opacity-40',
                    )}
                >
                    <input
                        type="checkbox"
                        checked={row.decider}
                        disabled={!row.canBeDecider}
                        onChange={(event) => {
                            const decider = event.target.checked
                            onChange((draft) => setFinalDecider(draft, key, decider))
                        }}
                        className="size-4 cursor-pointer accent-pickban-gold disabled:cursor-not-allowed"
                    />
                    Decider
                </label>
            </div>
            <div className="col-start-2 row-start-1 flex justify-end gap-1 @2xl/final:col-start-5">
                <RowButton label={`Move map ${mapNumber} up`} disabled={!row.canMoveUp} onClick={() => onChange((draft) => moveFinalEntry(draft, key, -1))}>
                    <ArrowUp className="size-4" />
                </RowButton>
                <RowButton label={`Move map ${mapNumber} down`} disabled={!row.canMoveDown} onClick={() => onChange((draft) => moveFinalEntry(draft, key, 1))}>
                    <ArrowDown className="size-4" />
                </RowButton>
                <RowButton label={`Remove map ${mapNumber}`} onClick={() => onChange((draft) => removeFinalEntry(draft, key))}>
                    <X className="size-4" />
                </RowButton>
            </div>
        </li>
    )
}

function RowButton({ label, ...props }: ComponentProps<'button'> & { label: string }) {
    return <button type="button" aria-label={label} title={label} className={ICON_BUTTON} {...props} />
}
