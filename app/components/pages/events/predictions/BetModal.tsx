import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { Modal } from '@/app/components/ui/modal'
import { ErrorBanner } from '@/app/components/pages/teams/teamsShared'
import {
    eventErrorMessage, fetchEventPredictionQuote, placeEventPredictionBet,
    type PredictionConfig, type PredictionMarket, type PredictionQuote,
    type PredictionSide, type PredictionWallet,
} from '@/app/utils/api'
import {
    SIDE_TEXT_STYLES, formatCoins, formatOdds, formatPercent, priceOf, sideLabel, sidesOf,
} from './predictionsShared'

const QUOTE_DEBOUNCE_MS = 250
const PRESET_FRACTIONS = [25, 50]

/**
 * How much worse than the quote a price may get before the server refuses the
 * prediction outright.
 *
 * The quote reserves nothing, so somebody else can move the market between it
 * being read and the button being pressed -- and on a cheap outcome one bet can
 * move it a long way. Without a cap the second player silently buys at the new
 * price. A small tolerance rather than none, because re-pricing at submit is
 * exact and a zero-tolerance cap would reject on floating-point dust.
 */
const SLIPPAGE_TOLERANCE = 0.02

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
    const [side, setSide] = useState<PredictionSide>(lockedSide ?? 'a')
    const [stakeText, setStakeText] = useState('')
    const [quote, setQuote] = useState<PredictionQuote | null>(null)
    const [quoting, setQuoting] = useState(false)
    const [staleQuote, setStaleQuote] = useState(0)
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

    const sides = sidesOf(market)
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
    }, [accessToken, slug, market.match_id, side, stake, stakeValid, staleQuote])

    const submit = useCallback(async () => {
        if (!stakeValid || !market.match_id) return
        setBusy(true)
        setError(null)
        try {
            await placeEventPredictionBet(accessToken, slug, market.match_id, {
                side,
                stake,
                idempotency_key: `${attempt.current}-${side}-${stake}`,
                ...(quote ? { max_slippage: quote.avg_price * (1 + SLIPPAGE_TOLERANCE) } : {}),
            })
            onPlaced()
            onClose()
        } catch (e) {
            setError(eventErrorMessage(e))
            setStaleQuote(nonce => nonce + 1)
        } finally {
            setBusy(false)
        }
    }, [accessToken, slug, market.match_id, side, stake, stakeValid, quote, onPlaced, onClose])

    const sideName = sideLabel(market, side)
    const price = priceOf(market, side)

    const disabledReason = useMemo(() => {
        if (ceiling < minStake) {
            return allowance < minStake
                ? `You have reached your ${formatCoins(perMatchCap)} limit for this match.`
                : 'You do not have enough coins left.'
        }
        return null
    }, [ceiling, minStake, allowance, perMatchCap])

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
                        {busy ? 'Placing…' : side === 'draw' ? 'Back the draw' : `Back ${sideName}`}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <ErrorBanner message={error} />

                {lockedSide && (
                    <div className="p-3 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-200 text-sm">
                        You are already backing <span className="font-semibold">{sideLabel(market, lockedSide)}</span> on
                        this match with {formatCoins(alreadyStaked)} coins. You can add to that, but the other outcomes are
                        closed to you here.
                    </div>
                )}

                <div className={cn('grid gap-2', sides.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
                    {sides.map(option => {
                        const name = sideLabel(market, option)
                        const optionPrice = priceOf(market, option)
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
                                <div className="flex items-baseline gap-1.5">
                                    <span className={cn('text-lg font-bold tabular-nums', SIDE_TEXT_STYLES[option])}>
                                        {formatOdds(optionPrice)}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground tabular-nums">
                                        {formatPercent(optionPrice)}
                                    </span>
                                </div>
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
                    <Row label="Your odds" value={formatOdds(price)} />
                    <Row
                        label={side === 'draw' ? 'If it is drawn, you get' : 'If they win, you get'}
                        value={quote ? `${formatCoins(quote.payout)} coins` : '—'}
                        emphasis
                        muted={quoting}
                    />
                    <Row
                        label="Board after your prediction"
                        value={quote ? `${formatOdds(quote.price_before)} → ${formatOdds(quote.price_after)}` : '—'}
                        muted={quoting}
                    />
                </div>

                {quote && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        <span className="text-white/80">You get the odds on the board.</span>{' '}
                        Your prediction moves the price for whoever comes next, but not for you —
                        the whole stake is struck at what you are looking at now. Getting in before
                        the crowd is worth something, and putting it on in one go beats dribbling
                        it in.
                    </p>
                )}

                {quote?.board_after && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground tabular-nums">
                        <span className="text-white/70">Everyone else then sees</span>
                        {sides.map(option => (
                            <span key={option}>
                                {sideLabel(market, option)}{' '}
                                <span className="text-white/80">
                                    {formatOdds(quote.board_after?.[option] ?? priceOf(market, option))}
                                </span>
                            </span>
                        ))}
                    </div>
                )}

                <p className="text-xs text-muted-foreground leading-relaxed">
                    That payout is locked in the moment you confirm — the odds can move afterwards, your return cannot.
                    If somebody moves the price before you press it, the prediction is refused rather than taken at
                    the new odds.
                    A prediction cannot be cancelled or sold, and you get one outcome per match.{' '}
                    {market.draws_allowed
                        ? 'This match can finish level, so the draw is one of the three things you can back.'
                        : 'This match has to produce a winner, so there is no draw to back.'}{' '}
                    If the match is forfeited or cancelled, your stake comes back.
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
