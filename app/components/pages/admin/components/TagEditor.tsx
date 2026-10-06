import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Input } from '@/app/components/ui/input'
import { ActionButton } from './controls'

export function TagEditor({ tags, onChange, suggestions }: { tags: string[]; onChange: (t: string[]) => void; suggestions: string[] }) {
  const [input, setInput] = useState('')
  const q = input.trim().toLowerCase()
  const hasTag = (value: string) => tags.some((t) => t.toLowerCase() === value.toLowerCase())
  const add = (tag: string) => {
    const v = tag.trim()
    if (v && !hasTag(v)) onChange([...tags, v])
    setInput('')
  }
  const matches = q ? suggestions.filter((s) => s.toLowerCase().includes(q) && !hasTag(s)).slice(0, 8) : []
  const exact = !!q && suggestions.some((s) => s.toLowerCase() === q)
  const canAddNew = !!q && !exact && !hasTag(input.trim())
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(input) } }}
          placeholder="Search or add a tag…" className="h-9 flex-1" />
        <ActionButton tone="accent" icon={Plus} onClick={() => add(input)} disabled={!input.trim()}>Add</ActionButton>
      </div>
      {(matches.length > 0 || canAddNew) && (
        <ul className="bg-card/30 border border-hairline/10 rounded-md divide-y divide-hairline/5 max-h-44 overflow-y-auto">
          {matches.map((s) => (
            <li key={s}>
              <button type="button" onClick={() => add(s)} className="w-full text-left px-3 py-2 text-sm hover:bg-hairline/5 cursor-pointer">{s}</button>
            </li>
          ))}
          {canAddNew && (
            <li>
              <button type="button" onClick={() => add(input.trim())} className="w-full text-left px-3 py-2 text-sm text-accent-300 hover:bg-hairline/5 cursor-pointer">
                Add new tag “{input.trim()}”
              </button>
            </li>
          )}
        </ul>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 text-xs bg-accent-500/10 border border-accent-500/20 text-accent-200 rounded px-2 py-0.5">
              {t}
              <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="text-accent-200/60 hover:text-accent-100 cursor-pointer"><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
