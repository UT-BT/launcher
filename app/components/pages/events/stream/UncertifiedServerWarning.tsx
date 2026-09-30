import { AlertTriangle } from 'lucide-react'

export const UNCERTIFIED_SERVER_WARNING = "Uncertified server: caps here won't count for the live score or records."

export function UncertifiedServerWarning({ testId }: { testId: string }) {
    return (
        <p data-testid={testId} className="flex items-start gap-2 text-xs text-amber-300">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{UNCERTIFIED_SERVER_WARNING}</span>
        </p>
    )
}
