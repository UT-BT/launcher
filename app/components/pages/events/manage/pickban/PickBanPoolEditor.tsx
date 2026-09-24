import { useId, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AdminSelect } from '@/app/components/pages/admin/components/controls'
import { ConfirmModal } from '@/app/components/shared/ConfirmModal'
import { MapNavLink } from '@/app/components/shared/MapNavLink'
import { MapSearchInput } from '@/app/components/shared/MapSearchInput'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { copyPickBanStagePool, eventErrorMessage, type PickBanPoolMap, type PickBanStageConfig } from '@/app/utils/api'
import { SubCard } from '../formatFields'
import { tagKey } from '../../pickBanTags'
import {
    addPoolMap, movePoolMap, poolError, poolHasMap, removePoolMap, withPoolTag, withoutPoolTag,
    type PickBanStageDraft,
} from './pickBanEditor'

export interface PoolProblem {
    map: string | null
    message: string
}

interface PickBanPoolEditorProps {
    accessToken: string
    slug: string
    stage: PickBanStageConfig
    draft: PickBanStageDraft
    poolDirty: boolean
    copySources: PickBanStageConfig[]
    problem: PoolProblem | null
    disabled: boolean
    onMapSelect?: (mapName: string) => void
    onChange: (draft: PickBanStageDraft) => void
    onProblem: (problem: PoolProblem | null) => void
    onCopied: () => Promise<void>
}

const iconButtonClass =
    'size-8 shrink-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent'

function TagInput({ listId, disabled, onAdd }: { listId: string; disabled: boolean; onAdd: (raw: string) => boolean }) {
    const [text, setText] = useState('')

    const commit = () => {
        if (!text.trim()) {
            setText('')
            return
        }
        if (onAdd(text)) setText('')
    }

    return (
        <input
            value={text}
            list={listId}
            disabled={disabled}
            placeholder="+ tag"
            aria-label="Add a tag"
            onChange={event => setText(event.target.value)}
            onBlur={commit}
            onKeyDown={event => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                commit()
            }}
            className="h-7 w-24 px-2 rounded-md border border-white/10 bg-card/50 text-[11px] text-white placeholder:text-muted-foreground focus:outline-none focus:border-accent-500/50 disabled:opacity-50"
        />
    )
}

function PoolRow({ entry, index, count, exclusionKeys, listId, error, disabled, onMapSelect, onMove, onRemove, onAddTag, onRemoveTag }: {
    entry: PickBanPoolMap
    index: number
    count: number
    exclusionKeys: Set<string>
    listId: string
    error: string | null
    disabled: boolean
    onMapSelect?: (mapName: string) => void
    onMove: (offset: -1 | 1) => void
    onRemove: () => void
    onAddTag: (raw: string) => boolean
    onRemoveTag: (tag: string) => void
}) {
    return (
        <li className={cn(
            'grid grid-cols-[1.25rem_2.25rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5 rounded-lg border p-2',
            '@xl/pool:grid-cols-[1.25rem_2.25rem_14rem_minmax(0,1fr)_auto]',
            error ? 'border-red-500/40 bg-red-500/5' : 'border-white/5 bg-white/[0.02]',
        )}>
            <span className="text-right text-[11px] tabular-nums text-muted-foreground">{index + 1}</span>
            <MapNavLink mapName={entry.map} onMapSelect={onMapSelect}>
                <MapThumbnail mapName={entry.map} version={entry.screenshot_version} className="size-9 rounded-md" />
            </MapNavLink>
            <MapNavLink
                mapName={entry.map}
                onMapSelect={onMapSelect}
                className="min-w-0 text-sm font-semibold text-foreground break-all hover:text-accent-300"
            >
                {entry.map}
            </MapNavLink>
            <div className="col-span-full row-start-2 flex flex-wrap items-center gap-1.5 pl-7 @xl/pool:col-span-1 @xl/pool:col-start-4 @xl/pool:row-start-1 @xl/pool:pl-0">
                {entry.tags.map(tag => (
                    <span
                        key={tagKey(tag)}
                        className={cn(
                            'inline-flex items-center gap-0.5 h-7 pl-2 rounded-md border text-[11px] font-medium',
                            exclusionKeys.has(tagKey(tag))
                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                : 'border-white/10 bg-white/5 text-foreground',
                        )}
                    >
                        {tag}
                        <button
                            type="button"
                            onClick={() => onRemoveTag(tag)}
                            disabled={disabled}
                            aria-label={`Remove the ${tag} tag from ${entry.map}`}
                            className="h-full px-1.5 inline-flex items-center rounded-r-md opacity-70 hover:opacity-100 cursor-pointer disabled:cursor-not-allowed"
                        >
                            <X className="size-3" />
                        </button>
                    </span>
                ))}
                <TagInput listId={listId} disabled={disabled} onAdd={onAddTag} />
            </div>
            <div className="col-start-4 row-start-1 flex items-center @xl/pool:col-start-5">
                <button type="button" onClick={() => onMove(-1)} disabled={disabled || index === 0} aria-label={`Move ${entry.map} up`} className={iconButtonClass}>
                    <ChevronUp className="size-4" />
                </button>
                <button type="button" onClick={() => onMove(1)} disabled={disabled || index === count - 1} aria-label={`Move ${entry.map} down`} className={iconButtonClass}>
                    <ChevronDown className="size-4" />
                </button>
                <button type="button" onClick={onRemove} disabled={disabled} aria-label={`Remove ${entry.map} from the pool`} className={cn(iconButtonClass, 'hover:text-red-300')}>
                    <Trash2 className="size-3.5" />
                </button>
            </div>
            {error && <p className="col-span-full pl-7 text-[11px] text-red-300">{error}</p>}
        </li>
    )
}

export function PickBanPoolEditor({
    accessToken, slug, stage, draft, poolDirty, copySources, problem, disabled, onMapSelect, onChange, onProblem, onCopied,
}: PickBanPoolEditorProps) {
    const listId = useId()
    const [searchKey, setSearchKey] = useState(0)
    const [copySource, setCopySource] = useState<PickBanStageConfig | null>(null)
    const [copying, setCopying] = useState(false)
    const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
    const pool = draft.pool
    const busy = disabled || copying

    const exclusionKeys = useMemo(
        () => new Set(draft.exclusions.map(rule => tagKey(rule.tag)).filter(Boolean)),
        [draft.exclusions],
    )
    const knownTags = useMemo(() => {
        const byKey = new Map<string, string>()
        for (const tag of [...draft.exclusions.map(rule => rule.tag.trim()), ...pool.flatMap(entry => entry.tags)]) {
            if (tag && !byKey.has(tagKey(tag))) byKey.set(tagKey(tag), tag)
        }
        return [...byKey.values()]
    }, [draft.exclusions, pool])

    const setPool = (next: PickBanPoolMap[]) => {
        setRowErrors({})
        onChange({ ...draft, pool: next })
    }

    const addMap = (mapName: string | null) => {
        if (!mapName) return
        setSearchKey(key => key + 1)
        if (poolHasMap(pool, mapName)) {
            onProblem({ map: mapName, message: `${mapName} is already in the pool.` })
            return
        }
        setPool(addPoolMap(pool, mapName))
    }

    const addTag = (index: number, raw: string) => {
        const result = withPoolTag(pool, index, raw)
        if (result.error) {
            setRowErrors({ [pool[index].map]: `The tag ${result.error}.` })
            return false
        }
        if (result.pool !== pool) setPool(result.pool)
        return true
    }

    const copy = async (source: PickBanStageConfig) => {
        setCopying(true)
        onProblem(null)
        try {
            await copyPickBanStagePool(accessToken, slug, stage.key, source.key)
            await onCopied()
        } catch (e) {
            onProblem(poolError(eventErrorMessage(e), pool))
        } finally {
            setCopying(false)
        }
    }

    const rowError = (mapName: string) => rowErrors[mapName] ?? (problem?.map === mapName ? problem.message : null)

    return (
        <SubCard title={`Map pool · ${pool.length} map${pool.length === 1 ? '' : 's'}`} className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
                <MapSearchInput
                    key={searchKey}
                    accessToken={accessToken}
                    value={null}
                    onChange={addMap}
                    disabled={busy}
                    placeholder="Search maps to add…"
                    className="flex-1 min-w-[12rem]"
                />
                {copySources.length > 0 && (
                    <AdminSelect
                        value=""
                        onChange={key => setCopySource(copySources.find(source => source.key === key) ?? null)}
                        options={copySources.map(source => ({ value: source.key, label: `${source.name} · ${source.pool.length} maps` }))}
                        placeholder={copying ? 'Copying…' : 'Copy from stage…'}
                        ariaLabel={`Copy a pool into ${stage.name}`}
                        className="h-8 w-full sm:w-48 text-xs"
                    />
                )}
            </div>

            {problem && !problem.map && <p className="text-[11px] text-red-300">{problem.message}</p>}
            {problem?.map && !poolHasMap(pool, problem.map) && <p className="text-[11px] text-red-300">{problem.message}</p>}

            {pool.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No maps yet. Add some above, or copy another stage&apos;s pool.</p>
            ) : (
                <ol className="@container/pool flex flex-col gap-1.5" aria-label={`${stage.name} map pool`}>
                    {pool.map((entry, index) => (
                        <PoolRow
                            key={entry.map}
                            entry={entry}
                            index={index}
                            count={pool.length}
                            exclusionKeys={exclusionKeys}
                            listId={listId}
                            error={rowError(entry.map)}
                            disabled={busy}
                            onMapSelect={onMapSelect}
                            onMove={offset => setPool(movePoolMap(pool, index, offset))}
                            onRemove={() => setPool(removePoolMap(pool, index))}
                            onAddTag={raw => addTag(index, raw)}
                            onRemoveTag={tag => setPool(withoutPoolTag(pool, index, tag))}
                        />
                    ))}
                </ol>
            )}

            <datalist id={listId}>
                {knownTags.map(tag => <option key={tagKey(tag)} value={tag} />)}
            </datalist>

            <ConfirmModal
                isOpen={!!copySource}
                onClose={() => setCopySource(null)}
                onConfirm={() => {
                    const source = copySource
                    setCopySource(null)
                    if (source) void copy(source)
                }}
                title="Copy a map pool"
                message={`Replace the ${stage.name} pool with the ${copySource?.pool.length ?? 0} saved maps and tags of ${copySource?.name ?? 'that stage'}?`}
                detail={poolDirty
                    ? 'This saves straight away and replaces the unsaved pool edits on this stage.'
                    : 'This saves straight away. Unsaved edits on the source stage are not copied.'}
                confirmText="Copy pool"
            />
        </SubCard>
    )
}
