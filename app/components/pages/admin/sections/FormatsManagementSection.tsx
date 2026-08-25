import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/app/components/ui/input'
import {
    createEventFormat, deleteEventFormat, eventErrorMessage, fetchEventFormat, fetchEventFormats,
    updateEventFormat,
    type EventFormatSpec, type EventFormatTemplate,
} from '@/app/utils/api'
import { FormatBuilder } from '@/app/components/pages/events/manage/FormatBuilder'
import { emptySpec, parseSpecErrors } from '@/app/components/pages/events/manage/formatFields'
import { ActionButton, ConfirmDialog, Feedback } from '../components/controls'
import { PANEL_LABEL } from '../components/shared'
import type { AdminSectionProps } from '../types'

interface Draft {
    slug: string
    name: string
    summary: string
    isPublic: boolean
    spec: EventFormatSpec
}

function draftFrom(template: EventFormatTemplate): Draft {
    return {
        slug: template.slug,
        name: template.name,
        summary: template.summary ?? '',
        isPublic: template.is_public,
        spec: template.spec ?? emptySpec(),
    }
}

function blankDraft(): Draft {
    return { slug: '', name: '', summary: '', isPublic: true, spec: emptySpec() }
}

export function FormatsManagementSection({ userProfile }: AdminSectionProps) {
    const token = userProfile?.accessToken ?? ''

    const [templates, setTemplates] = useState<EventFormatTemplate[]>([])
    const [selected, setSelected] = useState<string | null>(null)
    const [draft, setDraft] = useState<Draft | null>(null)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [feedback, setFeedback] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [deleteTarget, setDeleteTarget] = useState<EventFormatTemplate | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            setTemplates(await fetchEventFormats(token))
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => { void load() }, [load])

    const open = async (template: EventFormatTemplate) => {
        setError(null)
        setFieldErrors({})
        setSelected(template.slug)
        try {
            setDraft(draftFrom(await fetchEventFormat(token, template.slug)))
        } catch (e) {
            setError(eventErrorMessage(e))
        }
    }

    const startNew = () => {
        setSelected(null)
        setFieldErrors({})
        setError(null)
        setDraft(blankDraft())
    }

    const save = async () => {
        if (!draft) return

        setBusy(true)
        setError(null)
        setFeedback(null)
        setFieldErrors({})

        const input = {
            slug: draft.slug.trim(),
            name: draft.name.trim(),
            summary: draft.summary.trim() || null,
            is_public: draft.isPublic,
            spec: draft.spec,
        }

        try {
            const saved = selected
                ? await updateEventFormat(token, selected, input)
                : await createEventFormat(token, input)
            setSelected(saved.slug)
            setFeedback(`Saved "${saved.name}".`)
            await load()
        } catch (e) {
            const message = eventErrorMessage(e)
            const parsed = parseSpecErrors(message)
            setFieldErrors(parsed)
            setError(Object.keys(parsed).length ? 'The format has problems — see the highlighted fields.' : message)
        } finally {
            setBusy(false)
        }
    }

    const remove = async (template: EventFormatTemplate) => {
        setBusy(true)
        setError(null)
        try {
            await deleteEventFormat(token, template.slug)
            if (selected === template.slug) { setSelected(null); setDraft(null) }
            setFeedback(`Deleted "${template.name}".`)
            await load()
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="space-y-4">
            <Feedback message={feedback} tone="emerald" onDismiss={() => setFeedback(null)} />
            <Feedback message={error} tone="red" onDismiss={() => setError(null)} />

            <div className="grid gap-4 lg:grid-cols-[16rem_1fr] items-start">
                <div className="rounded-xl border border-hairline/10 bg-card/30 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-foreground">Templates</h3>
                        <ActionButton icon={Plus} onClick={startNew} disabled={busy}>New</ActionButton>
                    </div>

                    {loading ? (
                        <p className="text-xs text-muted-foreground">Loading…</p>
                    ) : templates.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No templates yet.</p>
                    ) : templates.map(template => (
                        <div key={template.id} className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => void open(template)}
                                className={cn(
                                    'flex-1 min-w-0 text-left px-2 py-1.5 rounded-md transition-colors cursor-pointer',
                                    selected === template.slug ? 'bg-accent-500/15 text-accent-300' : 'text-muted-foreground hover:text-foreground hover:bg-hairline/5',
                                )}
                            >
                                <span className="block truncate text-xs font-medium">{template.name}</span>
                                <span className="block truncate text-[11px] text-muted-foreground/70">{template.slug}</span>
                            </button>
                            <button
                                type="button"
                                title="Delete"
                                onClick={() => setDeleteTarget(template)}
                                className="p-1 rounded-md text-red-300 hover:bg-red-500/10 cursor-pointer shrink-0"
                            >
                                <Trash2 className="size-3.5" />
                            </button>
                        </div>
                    ))}
                </div>

                {draft ? (
                    <div className="rounded-xl border border-hairline/10 bg-card/30 p-4 space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                                <label className={PANEL_LABEL}>Name</label>
                                <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="UTBT 2v2 Cup" />
                            </div>
                            <div className="space-y-1">
                                <label className={PANEL_LABEL}>Slug</label>
                                <Input value={draft.slug} onChange={e => setDraft({ ...draft, slug: e.target.value })} placeholder="utbt-2v2-cup" />
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                                <label className={PANEL_LABEL}>Summary</label>
                                <Input value={draft.summary} onChange={e => setDraft({ ...draft, summary: e.target.value })} placeholder="Three groups, a record bracket, then a knockout." />
                            </div>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={draft.isPublic}
                                onChange={e => setDraft({ ...draft, isPublic: e.target.checked })}
                                style={{ colorScheme: 'dark' }}
                                className="size-4 accent-accent-500 cursor-pointer"
                            />
                            <span className="text-xs text-foreground">Offer this template when setting up an event</span>
                        </label>

                        <FormatBuilder
                            spec={draft.spec}
                            errors={fieldErrors}
                            disabled={busy}
                            onChange={spec => setDraft({ ...draft, spec })}
                        />

                        <div className="flex justify-end gap-2">
                            <ActionButton onClick={() => { setDraft(null); setSelected(null) }} disabled={busy}>Cancel</ActionButton>
                            <ActionButton tone="emerald" onClick={() => void save()} loading={busy}>
                                {selected ? 'Save template' : 'Create template'}
                            </ActionButton>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-hairline/10 bg-card/30 p-6 text-sm text-muted-foreground">
                        Pick a template to edit, or create a new one. Attaching a template to an event copies it —
                        later edits here never reshape an event that is already running.
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={!!deleteTarget}
                title="Delete template"
                message={`Delete "${deleteTarget?.name}"? Events already using it keep their own copy.`}
                confirmLabel="Delete"
                tone="red"
                busy={busy}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => {
                    const target = deleteTarget
                    setDeleteTarget(null)
                    if (target) void remove(target)
                }}
            />
        </div>
    )
}
