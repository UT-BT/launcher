import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminSelect, ActionButton } from '@/app/components/pages/admin/components/controls'
import { ConfirmModal } from '@/app/components/shared/ConfirmModal'
import { useNavState } from '@/app/components/navigation/useNavState'
import { ErrorBanner, SectionCard } from '@/app/components/pages/teams/teamsShared'
import {
    eventErrorMessage, fetchEventFormats, setEventFormat, updateEventFormatSpec,
    type EventBracket, type EventFormatSpec, type EventFormatTemplate,
} from '@/app/utils/api'
import { FormatBuilder } from './FormatBuilder'
import { emptySpec, parseSpecErrors } from './formatFields'

interface FormatPanelProps {
    accessToken: string
    slug: string
    bracket: EventBracket | null
    hasDrawnStages: boolean
    onBracketChange: (bracket: EventBracket) => void
    draft: EventFormatSpec | null
    onDraftChange: (draft: EventFormatSpec | null) => void
}

export function FormatPanel({
    accessToken, slug, bracket, hasDrawnStages, onBracketChange, draft, onDraftChange,
}: FormatPanelProps) {
    const attached = bracket?.format.spec ?? null

    const [templates, setTemplates] = useState<EventFormatTemplate[]>([])
    const [templateSlug, setTemplateSlug] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [confirmReplace, setConfirmReplace] = useState<string | null>(null)
    const [open, setOpen] = useNavState('event.manage.format', false)

    const spec = useMemo(() => draft ?? attached ?? emptySpec(), [draft, attached])
    const dirty = draft !== null

    useEffect(() => {
        fetchEventFormats(accessToken).then(setTemplates).catch(() => setTemplates([]))
    }, [accessToken])

    const options = useMemo(
        () => templates.map(template => ({ value: template.slug, label: template.name })),
        [templates],
    )

    const run = useCallback(async (action: () => Promise<EventBracket>) => {
        setBusy(true)
        setError(null)
        setFieldErrors({})
        try {
            onBracketChange(await action())
            onDraftChange(null)
        } catch (e) {
            const message = eventErrorMessage(e)
            const parsed = parseSpecErrors(message)
            setFieldErrors(parsed)
            setError(Object.keys(parsed).length ? 'The format has problems, see the highlighted fields.' : message)
        } finally {
            setBusy(false)
        }
    }, [onBracketChange, onDraftChange])

    const applyTemplate = (slugToApply: string) => {
        void run(() => setEventFormat(accessToken, slug, { format_slug: slugToApply }))
        setTemplateSlug(slugToApply)
    }

    const pickTemplate = (slugToApply: string) => {
        if (attached) setConfirmReplace(slugToApply)
        else applyTemplate(slugToApply)
    }

    const save = () => {
        void run(() => (attached
            ? updateEventFormatSpec(accessToken, slug, spec, !!bracket?.format.template)
            : setEventFormat(accessToken, slug, { spec })))
    }

    const preview = templates.find(template => template.slug === (confirmReplace ?? ''))

    return (
        <div className="space-y-4">
            <SectionCard
                title="Tournament format"
                subtitle={bracket?.format.template
                    ? `Based on the "${bracket.format.template.name}" template. Edits here only affect this event.`
                    : attached
                        ? 'A custom format, saved on this event alone.'
                        : 'Pick a template to start from, or build the stages yourself.'}
                collapsible
                open={open}
                onOpenChange={setOpen}
                action={
                    <div className="flex items-center gap-2">
                        {options.length > 0 && (
                            <AdminSelect
                                value={templateSlug}
                                onChange={pickTemplate}
                                options={options}
                                placeholder="Use a template…"
                                ariaLabel="Format template"
                                className="h-8 w-48"
                            />
                        )}
                        <ActionButton tone="emerald" onClick={save} loading={busy} disabled={!dirty && !!attached}>
                            {attached ? 'Save format' : 'Apply format'}
                        </ActionButton>
                    </div>
                }
            >
                <ErrorBanner message={error} />

                {dirty && (
                    <p className="text-[11px] text-amber-300">
                        Unsaved changes. {attached ? 'Save format' : 'Apply format'} to keep them.
                        They survive switching tabs, but not a reload.
                    </p>
                )}

                {hasDrawnStages && (
                    <p className="text-[11px] text-amber-300">
                        Stages that already have matches cannot change kind. Reset a stage first to reshape it.
                    </p>
                )}

                <FormatBuilder
                    spec={spec}
                    errors={fieldErrors}
                    disabled={busy}
                    onChange={onDraftChange}
                />
            </SectionCard>

            <ConfirmModal
                isOpen={!!confirmReplace}
                onClose={() => setConfirmReplace(null)}
                onConfirm={() => {
                    const target = confirmReplace
                    setConfirmReplace(null)
                    if (target) applyTemplate(target)
                }}
                title="Replace the format"
                message={`Replace this event's format with "${preview?.name ?? 'the template'}"?`}
                detail="Stages that already have matches will block the change until they are reset."
                confirmText="Replace format"
                variant="error"
            />
        </div>
    )
}
