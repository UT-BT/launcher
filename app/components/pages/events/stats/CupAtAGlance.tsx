import { useId, type CSSProperties, type ReactNode } from 'react'
import { Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import type { EventStatsMapRef, EventStatsRecords } from '@/app/utils/api'
import type { OverviewTeam } from './StatsOverview'
import { OverviewTeamLink } from './OverviewTeamLink'
import { TeamAvatars } from './team/teamShared'
import { teamAccentColor } from './teamAccent'
import './overviewStats.css'

export interface GlanceMapTile {
    kind: 'map'
    label: string
    value: string
    unit: string
    tone: 'pick' | 'ban'
    map: EventStatsMapRef
}

export interface GlanceRateTile {
    kind: 'rate'
    label: string
    value: string
    share: number
}

export interface GlanceTeamTile {
    kind: 'team'
    label: string
    value: string
    unit?: string
    team: OverviewTeam
}

export interface GlanceUpsetTile {
    kind: 'upset'
    label: string
    score: string
    winner: { team: OverviewTeam; seed: number }
    loser: { team: OverviewTeam; seed: number }
}

export type GlanceTile = GlanceMapTile | GlanceRateTile | GlanceTeamTile | GlanceUpsetTile

export interface CupAtAGlanceView {
    tiles: GlanceTile[]
    emptyText: string | null
}

export const GLANCE_EMPTY_TEXT = 'Headlines appear once a match in this stage has an official result.'

const plural = (count: number, noun: string) => `${noun}${count === 1 ? '' : 's'}`

export function cupAtAGlanceView(records: EventStatsRecords, teams: Record<string, OverviewTeam>): CupAtAGlanceView {
    const { most_picked: picked, most_banned: banned, first_ban: first, picker, best_defence: defence,
        biggest_upset: upset, most_comebacks: comebacks } = records
    const defenceTeam = defence && teams[defence.team_id]
    const comebacksTeam = comebacks && teams[comebacks.team_id]
    const winner = upset && teams[upset.winner_id]
    const loser = upset && teams[upset.loser_id]
    const tiles: (GlanceTile | null)[] = [
        picked && { kind: 'map', label: 'Most picked', value: `${picked.picks}`, unit: plural(picked.picks, 'pick'), tone: 'pick', map: picked },
        banned && { kind: 'map', label: 'Most banned', value: `${banned.bans}`, unit: plural(banned.bans, 'ban'), tone: 'ban', map: banned },
        first && { kind: 'map', label: 'Banned first most', value: `${first.first_bans}`, unit: plural(first.first_bans, 'first ban'), tone: 'ban', map: first },
        picker && { kind: 'rate', label: 'Picker win rate', value: `${Math.round(picker.rate * 100)}%`, share: picker.rate },
        defence && defenceTeam
            ? { kind: 'team', label: 'Fewest caps conceded', value: `${defence.caps_against}`, unit: `in ${defence.maps} ${plural(defence.maps, 'map')}`, team: defenceTeam }
            : null,
        upset && winner && loser
            ? {
                kind: 'upset',
                label: 'Biggest upset',
                score: `${upset.score.winner}–${upset.score.loser}`,
                winner: { team: winner, seed: upset.winner_seed },
                loser: { team: loser, seed: upset.loser_seed },
            }
            : null,
        comebacks && comebacksTeam ? { kind: 'team', label: 'Most comebacks', value: `${comebacks.count}`, team: comebacksTeam } : null,
    ]
    const shown = tiles.filter((tile): tile is GlanceTile => !!tile)
    return { tiles: shown, emptyText: shown.length ? null : GLANCE_EMPTY_TEXT }
}

const LABEL = 'text-[10px] font-bold uppercase tracking-wider'
const VALUE = 'text-4xl font-black leading-none tabular-nums'

const MAP_TONES: Record<GlanceMapTile['tone'], string> = {
    pick: 'text-emerald-300',
    ban: 'text-red-300',
}

function MapTile({ tile }: { tile: GlanceMapTile }) {
    return (
        <div className="glance-map glance-tall relative isolate flex flex-col justify-between overflow-hidden rounded-xl p-3 text-white">
            <MapThumbnail mapName={tile.map.map} alt="" size="card" className="absolute inset-0 -z-10 size-full rounded-none border-0" />
            <span className={cn(LABEL, MAP_TONES[tile.tone])}>{tile.label}</span>
            <div className="flex min-w-0 flex-col gap-1">
                <span className="flex items-baseline gap-1.5">
                    <span className={VALUE}>{tile.value}</span>
                    <span className="text-sm font-semibold text-white/75">{tile.unit}</span>
                </span>
                <span className="truncate text-sm font-bold">{tile.map.display_name}</span>
            </div>
        </div>
    )
}

function RateTile({ tile }: { tile: GlanceRateTile }) {
    return (
        <div className="glance-tall flex flex-col justify-between gap-3 rounded-xl border border-hairline/10 bg-card/40 p-3">
            <span className={cn(LABEL, 'text-muted-foreground')}>{tile.label}</span>
            <span className="flex items-center gap-3">
                <span className="glance-ring shrink-0" style={{ '--share': `${tile.share * 100}%` } as CSSProperties} aria-hidden />
                <span className={cn(VALUE, 'text-foreground')}>{tile.value}</span>
            </span>
        </div>
    )
}

function TeamCardShell({ accent, className, children }: { accent: string; className?: string; children: ReactNode }) {
    return (
        <div
            className={cn('glance-team flex min-w-0 flex-col justify-between gap-3 rounded-xl border border-hairline/10 p-3', className)}
            style={{ '--glance-accent': accent } as CSSProperties}
        >
            {children}
        </div>
    )
}

function TeamTile({ tile, eventSlug }: { tile: GlanceTeamTile; eventSlug: string }) {
    const accent = teamAccentColor(tile.team.accentSlot)
    return (
        <TeamCardShell accent={accent}>
            <span className={cn(LABEL, 'text-muted-foreground')}>{tile.label}</span>
            <span className="flex items-baseline gap-1.5">
                <span className={cn(VALUE, 'text-foreground')}>{tile.value}</span>
                {tile.unit && <span className="text-sm font-semibold text-muted-foreground">{tile.unit}</span>}
            </span>
            <OverviewTeamLink team={tile.team} eventSlug={eventSlug} className="flex min-w-0 flex-wrap items-center gap-2.5">
                <TeamAvatars members={tile.team.members} accent={accent} size="md" />
                <span className="min-w-0 break-words font-bold leading-tight" style={{ color: accent }}>{tile.team.name}</span>
            </OverviewTeamLink>
        </TeamCardShell>
    )
}

function UpsetSide({ side, eventSlug, align }: { side: GlanceUpsetTile['winner']; eventSlug: string; align: 'start' | 'end' }) {
    const accent = teamAccentColor(side.team.accentSlot)
    return (
        <OverviewTeamLink
            team={side.team}
            eventSlug={eventSlug}
            className={cn('glance-upset-side flex min-w-0 flex-1 items-center gap-2.5', align === 'end' && 'glance-upset-end flex-row-reverse text-right')}
        >
            <TeamAvatars members={side.team.members} accent={accent} size="md" />
            <span className="flex min-w-0 flex-col">
                <span className="break-words font-bold leading-tight" style={{ color: accent }}>{side.team.name}</span>
                <span className="text-xs font-semibold text-muted-foreground">Seed {side.seed}</span>
            </span>
        </OverviewTeamLink>
    )
}

function UpsetTile({ tile, eventSlug }: { tile: GlanceUpsetTile; eventSlug: string }) {
    return (
        <TeamCardShell accent={teamAccentColor(tile.winner.team.accentSlot)} className="glance-wide">
            <span className={cn(LABEL, 'text-muted-foreground')}>{tile.label}</span>
            <div className="flex items-center gap-3">
                <UpsetSide side={tile.winner} eventSlug={eventSlug} align="start" />
                <span className={cn(VALUE, 'shrink-0 text-foreground')}>{tile.score}</span>
                <UpsetSide side={tile.loser} eventSlug={eventSlug} align="end" />
            </div>
        </TeamCardShell>
    )
}

function Tile({ tile, eventSlug }: { tile: GlanceTile; eventSlug: string }) {
    switch (tile.kind) {
        case 'map': return <MapTile tile={tile} />
        case 'rate': return <RateTile tile={tile} />
        case 'team': return <TeamTile tile={tile} eventSlug={eventSlug} />
        case 'upset': return <UpsetTile tile={tile} eventSlug={eventSlug} />
    }
}

export function CupAtAGlance({ records, teams, eventSlug }: {
    records: EventStatsRecords
    teams: Record<string, OverviewTeam>
    eventSlug: string
}) {
    const view = cupAtAGlanceView(records, teams)
    const headingId = useId()

    return (
        <section aria-labelledby={headingId} className="glance flex flex-col gap-3">
            <h2 id={headingId} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-yellow-300">
                <Timer className="size-4" aria-hidden />
                Cup at a glance
            </h2>
            {view.emptyText
                ? <p className="rounded-xl border border-hairline/10 bg-card/30 px-4 py-6 text-sm text-muted-foreground">{view.emptyText}</p>
                : (
                    <div className="glance-tiles grid gap-2.5">
                        {view.tiles.map(tile => <Tile key={tile.label} tile={tile} eventSlug={eventSlug} />)}
                    </div>
                )}
        </section>
    )
}
