import { useState } from 'react'
import { AlertTriangle, ArrowDownRight, Check, CheckCircle2, ChevronRight, Copy, Loader2, OctagonX, Package, Server, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Draft, DraftBlock, DraftWarning } from '@/app/utils/mapUploadTypes'
import { BLOCK_TITLE, WARNING_TITLE, countLabel } from './reportLabels'
import { blockField, groupObjects, warningField, type DraftField } from './reportView'
import { IconTile, MonoChip, Panel } from './Panel'
import { ToneChip } from './ToneChip'

const INLINE_OBJECT_LIMIT = 6

function CopyAllButton({ values }: { values: string[] }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(values.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }
  return (
    <button type="button" onClick={() => { void copy() }} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-hairline/5 hover:text-foreground cursor-pointer">
      {copied ? <Check className="size-3 text-emerald-300" /> : <Copy className="size-3" />}
      {copied ? 'Copied' : 'Copy all'}
    </button>
  )
}

function ObjectChip({ group, name }: { group: string | null; name: string }) {
  return (
    <MonoChip>
      {group && <span className="text-muted-foreground">{group}.</span>}{name}
    </MonoChip>
  )
}

function ObjectList({ objects }: { objects: string[] }) {
  const [open, setOpen] = useState(false)
  const groups = groupObjects(objects)
  const noun = countLabel(objects.length, 'object')

  if (objects.length <= INLINE_OBJECT_LIMIT) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-0.5 text-[11px] text-muted-foreground">Uses</span>
        {groups.flatMap(({ group, names }) => names.map((name, i) => <ObjectChip key={`${group}-${name}-${i}`} group={group} name={name} />))}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 text-xs font-medium text-accent-300 hover:text-accent-200 cursor-pointer"
      >
        <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
        {open ? `Hide the ${noun}` : `Show the ${noun} the map uses`}
      </button>
      {open && (
        <div className="rounded-lg border border-hairline/5 bg-background/40">
          <div className="flex items-center justify-between gap-2 border-b border-hairline/5 px-3 py-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{noun} in {groups.length} {groups.length === 1 ? 'group' : 'groups'}</span>
            <CopyAllButton values={objects} />
          </div>
          <dl className="grid max-h-60 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2 overflow-y-auto px-3 py-2.5">
            {groups.map(({ group, names }) => (
              <div key={group ?? ''} className="contents">
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {group ?? 'Package'} <span className="tabular-nums text-muted-foreground/60">{names.length}</span>
                </dt>
                <dd className="flex flex-wrap gap-1">
                  {names.map((name, i) => <MonoChip key={`${name}-${i}`}>{name}</MonoChip>)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

function FixLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-hairline/10 bg-hairline/5 px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:border-hairline/20 hover:text-foreground cursor-pointer"
    >
      {label}
      <ArrowDownRight className="size-3" />
    </button>
  )
}

function IssueRow({ kind, title, message, block, field, onJump }: {
  kind: 'block' | 'warning'
  title: string
  message: string
  block?: DraftBlock
  field: DraftField | null
  onJump: (field: DraftField) => void
}) {
  const isBlock = kind === 'block'
  const hosts = block?.hosts ?? []
  return (
    <li className="relative flex gap-3 px-4 py-3">
      <span aria-hidden className={cn('absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full', isBlock ? 'bg-red-500/70' : 'bg-amber-500/70')} />
      <IconTile icon={isBlock ? OctagonX : AlertTriangle} tone={isBlock ? 'red' : 'amber'} size="sm" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <p className="pt-1 text-sm font-medium leading-snug text-foreground">{title}</p>
          {field && <FixLink label={isBlock ? 'Fix' : 'Review'} onClick={() => onJump(field)} />}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{message}</p>
        {(block?.package || hosts.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {block?.package && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Package className="size-3" /><MonoChip>{block.package}</MonoChip>
              </span>
            )}
            {hosts.map((host) => (
              <span key={host} className="inline-flex items-center gap-1 rounded-md border border-hairline/10 bg-hairline/5 px-1.5 py-0.5 text-[11px] text-foreground/90">
                <Server className="size-3 text-muted-foreground" />{host}
              </span>
            ))}
          </div>
        )}
        {block && block.objects.length > 0 && <ObjectList objects={block.objects} />}
      </div>
    </li>
  )
}

function checksTone(draft: Draft): 'red' | 'amber' | 'emerald' {
  if (draft.blocks.length > 0) return 'red'
  return draft.warnings.length > 0 ? 'amber' : 'emerald'
}

function checksMeta(draft: Draft): string {
  if (draft.status === 'analyzing') return 'Checking the archive. This updates by itself.'
  if (draft.blocks.length > 0) return `${countLabel(draft.blocks.length, 'issue')} must be fixed before publishing.`
  if (draft.warnings.length > 0) return 'Nothing blocks publishing. Read the warnings first.'
  return 'Everything checks out.'
}

export function DraftChecks({ draft, onJump }: { draft: Draft; onJump: (field: DraftField) => void }) {
  const analyzing = draft.status === 'analyzing'
  const tone = checksTone(draft)
  return (
    <Panel
      title="Checks"
      icon={analyzing ? Loader2 : tone === 'emerald' ? ShieldCheck : tone === 'red' ? OctagonX : AlertTriangle}
      tone={analyzing ? 'accent' : tone}
      spin={analyzing}
      meta={checksMeta(draft)}
      actions={!analyzing && (
        <>
          {draft.blocks.length > 0 && <ToneChip tone="red">{countLabel(draft.blocks.length, 'block')}</ToneChip>}
          {draft.warnings.length > 0 && <ToneChip tone="amber">{countLabel(draft.warnings.length, 'warning')}</ToneChip>}
        </>
      )}
    >
      {analyzing ? (
        <div className="space-y-3 px-4 py-4" aria-busy>
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="size-7 rounded-lg bg-hairline/5 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-1/2 rounded bg-hairline/5 animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-hairline/5 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : draft.blocks.length === 0 && draft.warnings.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-4 text-sm text-emerald-300">
          <CheckCircle2 className="size-4" />No blocks and no warnings.
        </p>
      ) : (
        <ul className="divide-y divide-hairline/5">
          {draft.blocks.map((block, i) => (
            <IssueRow key={`b-${block.code}-${i}`} kind="block" title={BLOCK_TITLE[block.code]} message={block.message}
              block={block} field={blockField(block.code)} onJump={onJump} />
          ))}
          {draft.warnings.map((warning: DraftWarning, i) => (
            <IssueRow key={`w-${warning.code}-${i}`} kind="warning" title={WARNING_TITLE[warning.code]} message={warning.message}
              field={warningField(warning.code)} onJump={onJump} />
          ))}
        </ul>
      )}
    </Panel>
  )
}
