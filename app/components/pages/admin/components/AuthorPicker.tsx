import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { fetchAdminUsers, toActiveTitle, type AdminUserRow } from '@/app/utils/api'
import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { Input } from '@/app/components/ui/input'

export interface AuthorUser { id: string; alias: string | null }

export function AuthorPicker({ mode, setMode, authorStr, setAuthorStr, authorUser, setAuthorUser, token }: {
  mode: 'text' | 'player'
  setMode: (m: 'text' | 'player') => void
  authorStr: string
  setAuthorStr: (v: string) => void
  authorUser: AuthorUser | null
  setAuthorUser: (u: AuthorUser | null) => void
  token: string
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AdminUserRow[]>([])

  useEffect(() => {
    if (mode !== 'player' || authorUser || !query.trim()) { setResults([]); return }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      fetchAdminUsers(token, { search: query, limit: 8 }, ctrl.signal).then(setResults).catch(() => {})
    }, 300)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [mode, query, authorUser, token])

  return (
    <div className="space-y-2">
      <div className="inline-flex rounded-md border border-hairline/10 overflow-hidden text-xs">
        {(['text', 'player'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={cn('px-3 py-1.5 cursor-pointer transition-colors', mode === m ? 'bg-accent-500/15 text-accent-200' : 'text-muted-foreground hover:text-foreground')}>
            {m === 'text' ? 'Name' : 'Player'}
          </button>
        ))}
      </div>

      {mode === 'text' ? (
        <Input value={authorStr} onChange={(e) => setAuthorStr(e.target.value)} placeholder="Author name" className="h-9" />
      ) : authorUser ? (
        <div className="flex items-center justify-between gap-2 bg-card/30 border border-hairline/10 rounded-md px-3 h-10">
          <PlayerInfo userId={authorUser.id} alias={authorUser.alias} title={null} size="sm" interactive={false} />
          <button type="button" onClick={() => setAuthorUser(null)} className="text-muted-foreground/60 hover:text-foreground cursor-pointer shrink-0"><X className="size-4" /></button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60 pointer-events-none" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search players…" className="h-9 pl-9" />
          </div>
          {results.length > 0 && (
            <ul className="bg-card/30 border border-hairline/10 rounded-md divide-y divide-hairline/5 max-h-44 overflow-y-auto">
              {results.map((u) => (
                <li key={u.id}>
                  <button type="button" onClick={() => { setAuthorUser({ id: u.id, alias: u.alias }); setQuery('') }}
                    className="w-full text-left px-3 py-2 hover:bg-hairline/5 cursor-pointer">
                    <PlayerInfo userId={u.id} alias={u.alias} title={toActiveTitle(u.active_title)} size="sm" interactive={false} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
