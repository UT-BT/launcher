import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/app/components/ui/tooltip'

type Tone =
    | 'neutral'
    | 'accent'
    | 'blue'
    | 'purple'
    | 'emerald'
    | 'amber'
    | 'red'
    | 'yellow'

const TONE_CLASSES: Record<Tone, string> = {
    neutral: 'bg-hairline/5 border-hairline/5 text-foreground',
    accent:  'bg-accent-500/15 border-accent-500/40 text-accent-200',
    blue:    'bg-blue-500/15 border-blue-500/40 text-blue-200',
    purple:  'bg-purple-500/15 border-purple-500/40 text-purple-200',
    emerald: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
    amber:   'bg-amber-500/15 border-amber-500/40 text-amber-300',
    red:     'bg-red-500/15 border-red-500/40 text-red-300',
    yellow:  'bg-yellow-500/15 border-yellow-500/40 text-yellow-300',
}

const TONE_ICON: Record<Tone, string> = {
    neutral: 'text-muted-foreground',
    accent:  'text-accent-300',
    blue:    'text-blue-300',
    purple:  'text-purple-300',
    emerald: 'text-emerald-300',
    amber:   'text-amber-300',
    red:     'text-red-300',
    yellow:  'text-yellow-300',
}

interface MetaPillProps {
    icon?: LucideIcon
    label?: string
    value?: React.ReactNode
    tone?: Tone
    tooltip?: React.ReactNode
    href?: string
    onClick?: () => void
    className?: string
    children?: React.ReactNode
}

/**
 * Standardized info pill used in detail-page headers (User/Map). All variants
 * share the same height (h-7), padding (px-2), gap, border radius, and
 * baseline alignment so a row of pills lines up cleanly regardless of which
 * variants are present.
 */
export function MetaPill({
    icon: Icon, label, value, tone = 'neutral', tooltip, href, onClick, className, children,
}: MetaPillProps) {
    const Comp: any = href ? 'a' : onClick ? 'button' : 'span'

    const interactive = href || onClick

    const content = (
        <Comp
            href={href}
            target={href ? '_blank' : undefined}
            rel={href ? 'noreferrer' : undefined}
            onClick={onClick}
            type={onClick && !href ? 'button' : undefined}
            className={cn(
                'inline-flex flex-wrap items-center gap-1.5 min-h-7 py-1 px-2 rounded-md border text-xs leading-none max-w-full',
                TONE_CLASSES[tone],
                interactive && 'cursor-pointer hover:brightness-125 transition-all',
                className,
            )}
        >
            {Icon && <Icon className={cn('size-3 shrink-0', TONE_ICON[tone])} />}
            {label && (
                <span className={cn('text-[10px] font-bold uppercase tracking-wider', TONE_ICON[tone])}>
                    {label}
                </span>
            )}
            {value !== undefined && (
                <span className="font-semibold font-mono tabular-nums">
                    {value}
                </span>
            )}
            {children}
        </Comp>
    )

    if (tooltip) {
        return <Tooltip content={tooltip} side="bottom">{content}</Tooltip>
    }
    return content
}
