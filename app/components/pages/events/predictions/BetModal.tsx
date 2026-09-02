import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { Modal } from '@/app/components/ui/modal'
import { ErrorBanner } from '@/app/components/pages/teams/teamsShared'
import {
    eventErrorMessage, fetchEventPredictionQuote, placeEventPredictionBet,
    type EventSide, type PredictionConfig, type PredictionMarket, type PredictionQuote,
    type PredictionWallet,
} from '@/app/utils/api'
import { formatCoins, formatMultiplier, formatPercent } from './predictionsShared'

const QUOTE_DEBOUNCE_MS = 250
const PRESET_FRACTIONS = [25, 50]

interface BetModalProps {
    slug: string
    accessToken: string
    market: PredictionMarket
    config: PredictionConfig
    wallet: PredictionWallet
    onClose: () => void
    onPlaced: () => void
}

/**
 * Stake shortcuts as a share of what this player can actually put on this match,
 * not fixed coin amounts: 10/25/50/100 is meaningless to someone holding 10,000.
 * The floor is the configured minimum where there is one, and the ceiling is
 * whichever of balance or per-match cap bites first.
 */
function stakePresets(ceiling: number, minStake: number): Array<{ label: string; value: number }> {
    if (ceiling < minStake) return []

    const candidates: Array<{ label: string; value: number }> = []

    if (minStake > 1) candidates.push({ label: 'Min', value: minStake })

    for (const fraction of PRESET_FRACTIONS) {
        candidates.push({ label: `${fraction}%`, value: Math.floor((ceiling * fraction) / 100) })
    }

    candidates.push({ label: 'Max', value: ceiling })

    const seen = new Set<number>()
    const usable: Array<{ label: string; value: number }> = []

    for (const preset of candidates) {
        if (preset.value < minStake || preset.value > ceiling || seen.has(preset.value)) continue
        seen.add(preset.value)
        usable.push(preset)
    }

    return usable.sort((left, right) => left.value - right.value)
}

export function BetModal({ slug, accessToken, market, config, wallet, onClose, onPlaced }: BetModalProps) {
    const held = market.your_position
    const lockedSide = held?.side ?? null
    const [side, setSide] = useState<EventSide>(lockedSide ?? 'a')
    const [stakeText, setStakeText] = useState('')
    const [quote, setQuote] = useState<PredictionQuote | null>(null)
    const [quoting, setQuoting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    // Side and stake are appended at submit: the server matches on the key
    // alone, so a modal-scoped one would replay the first bet after an edit.
    const attempt = useRef(`${market.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`)

    const balance = wallet.balance
    const minStake = config.min_stake ?? 1
    const perMatchCap = wallet.max_stake
    const alreadyStaked = held?.stake ?? 0
    const allowance = perMatchCap > 0 ? Math.max(0, perMatchCap - alreadyStaked) : balance
    const ceiling = Math.min(balance, allowance)
    const presets = useMemo(() => stakePresets(ceiling, minStake), [ceiling, minStake])

    const stake = Number.parseInt(stakeText, 10)
    const stakeValid = Number.isInteger(stake) && stake >= minStake && stake <= ceiling

    const teamA = market.team_a?.name || 'Side A'
    const teamB = market.team_b?.name || 'Side B'

    useEffect(() => {
        if (!stakeValid || !market.match_id) {
            setQuote(null)
            return
        }

        const controller = new AbortController()
        const timer = setTimeout(() => {
            setQuoting(true)
            fetchEventPredictionQuote(accessToken, slug, market.match_id as string, side, stake, controller.signal)
                .then(next => setQuote(next))
                .catch(() => setQuote(null))
                .finally(() => setQuoting(false))
        }, QUOTE_DEBOUNCE_MS)

        return () => {
            controller.abort()
            clearTimeout(timer)
        }
    }, [accessToken, slug, market.match_id, side, stake, stakeValid])

    const submit = useCallback(async () => {
        if (!stakeValid || !market.match_id) return
        setBusy(true)
        setError(null)
        try {
            await placeEventPredictionBet(accessToken, slug, market.match_id, {
                side,
                stake,
                idempotency_key: `${attempt.current}-${side}-${stake}`,
            })
            onPlaced()
            onClose()
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setBusy(false)
        }
    }, [accessToken, slug, market.match_id, side, stake, stakeValid, onPlaced, onClose])

    const sideName = side === 'a' ? teamA : teamB
    const price = side === 'a' ? market.price_a : market.price_b

    const disabledReason = useMemo(() => {
        if (ceiling < minStake) {
            return allowance < minStake
                ? `You have reached your ${formatCoins(perMatchCap)} limit for this match.`
                : 'You do not have enough coins left.'
        }
        return null
    }, [ceiling, minStake, allowance, perMatchCap])

    const impact = quote && quote.stake > 0 && quote.payout > 0
        ? (1 / quote.price_before) - (quote.payout / quote.stake)
        : 0

    return (
        <Modal
            isOpen
            onClose={onClose}
            offsetSidebar
            maxWidth="30rem"
            title={`${teamA} vs ${teamB}`}
            footer={
                <div className="p-4 border-t border-border bg-muted/50 flex items-center justify-end gap-2">
                    <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
                    <Button onClick={submit} disabled={!stakeValid || busy || !!disabledReason}>
                        {busy ? 'Placing…' : `Back ${sideName}`}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <ErrorBanner message={error} />

                {lockedSide && (
                    <div className="p-3 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-200 text-sm">
                        You are already backing <span className="font-semibold">{lockedSide === 'a' ? teamA : teamB}</span> on
                        this match with {formatCoins(alreadyStaked)} coins. You can add to that side, but the other side is
                        closed to you here.
                    </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                    {(['a', 'b'] as EventSide[]).map(option => {
                        const name = option === 'a' ? teamA : teamB
                        const optionPrice = option === 'a' ? market.price_a : market.price_b
                        const locked = !!lockedSide && lockedSide !== option

                        return (
                            <button
                                key={option}
                                type="button"
                                disabled={locked}
                                onClick={() => setSide(option)}
                                className={cn(
                                    'p-3 rounded-lg border text-left transition-colors',
                                    side === option
                                        ? 'border-accent-500/60 bg-accent-500/10'
                                        : 'border-white/10 bg-card/50 hover:border-white/20',
                                    locked && 'opacity-40 cursor-not-allowed hover:border-white/10',
                                )}
                            >
                                <div className="text-sm font-semibold text-white truncate">{name}</div>
                                <div className="text-xs text-muted-foreground tabular-nums">{formatPercent(optionPrice)} chance</div>
                            </button>
                        )
                    })}
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Stake</span>
                        <span className="tabular-nums">
                            {formatCoins(balance)} available{perMatchCap > 0 && ` · ${formatCoins(allowance)} left on this match`}
                        </span>
                    </div>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={minStake}
                        max={ceiling}
                        value={stakeText}
                        onChange={event => setStakeText(event.target.value)}
                        placeholder={`${formatCoins(minStake)}–${formatCoins(ceiling)}`}
                        className="px-3 py-2 bg-card/50 border border-white/10 rounded-lg text-sm text-white tabular-nums placeholder:text-muted-foreground focus:outline-none focus:border-accent-500/50"
                    />
                    {presets.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {presets.map(preset => (
                                <button
                                    key={preset.label}
                                    type="button"
                                    title={`${formatCoins(preset.value)} coins`}
                                    onClick={() => setStakeText(String(preset.value))}
                                    className={cn(
                                        'px-2 py-1 rounded border text-xs transition-colors',
                                        stake === preset.value
                                            ? 'border-accent-500/60 bg-accent-500/10 text-white'
                                            : 'border-white/10 bg-card/50 text-muted-foreground hover:text-white hover:border-white/20',
                                    )}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-3 rounded-lg border border-white/10 bg-card/40 flex flex-col gap-1.5 text-sm">
                    <Row label="Odds now" value={formatPercent(price)} />
                    <Row
                        label="If they win, you get"
                        value={quote ? `${formatCoins(quote.payout)} coins` : '—'}
                        emphasis
                        muted={quoting}
                    />
                    <Row label="Return" value={quote ? formatMultiplier(quote.stake, quote.payout) : '—'} muted={quoting} />
                    <Row
                        label="Your average price"
                        value={quote ? formatPercent(quote.stake / quote.payout) : '—'}
                        muted={quoting}
                    />
                    <Row
                        label="Odds after your bet"
                        value={quote ? `${formatPercent(quote.price_before)} → ${formatPercent(quote.price_after)}` : '—'}
                        muted={quoting}
                    />
                </div>

                {quote && impact > 0.005 && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        <span className="text-white/80">Why the return drops as you stake more:</span>{' '}
                        your own coins move the odds while they go in, so the last of them buys at a worse price than
                        the first. Splitting the same total into several smaller predictions costs exactly the same —
                        the price picks up where it left off.
                    </p>
                )}

                <p className="text-xs text-muted-foreground leading-relaxed">
                    That payout is locked in the moment you confirm — the odds can move afterwards, your return cannot.
                    A prediction cannot be cancelled or sold. If the match is drawn, forfeited or cancelled, your stake
                    comes back.
                </p>

                {disabledReason && <ErrorBanner message={disabledReason} />}
            </div>
        </Modal>
    )
}

function Row({ label, value, emphasis, muted }: {
    label: string
    value: string
    emphasis?: boolean
    muted?: boolean
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className={cn(
                'tabular-nums',
                emphasis ? 'text-base font-semibold text-white' : 'text-white/80',
                muted && 'opacity-50',
            )}>
                {value}
            </span>
        </div>
    )
}
