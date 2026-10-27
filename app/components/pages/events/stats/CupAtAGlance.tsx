import { useId } from 'react'
import { ArrowUpRight, Timer } from 'lucide-react'
import { PickBanLink } from '@/app/components/pages/events/pickban/components/PickBanLink'
import { SCREENSHOT_SIZE_PX, derivedScreenshotUrl } from '@/app/utils/mapScreenshots'
import type { EventStatsMapRef, EventStatsRecords } from '@/app/utils/api'
import { paceText } from './statsView'
import type { OverviewTeam } from './StatsOverview'
import { OverviewTeamLink } from './OverviewTeamLink'
import { MapName } from './MapStatsTable'
import { TeamAvatars } from './team/teamShared'
import { teamAccentColor } from './teamAccent'
import './overviewStats.css'

export interface GlanceTile {
    label: string
    value: string
    suffix?: string
    map?: EventStatsMapRef
    team?: OverviewTeam
    subject?: string
    note: string
    upset?: { loser: OverviewTeam; matchId: string }
}

export interface CupAtAGlanceView {
    backdropMap: string | null
    mapTiles: GlanceTile[]
    teamTiles: GlanceTile[]
    emptyText: string | null
}

export const GLANCE_EMPTY_TEXT = 'Headlines appear once a match in this stage has an official result.'

const plural = (count: number) => (count === 1 ? '' : 's')

export function cupAtAGlanceView(records: EventStatsRecords, teams: Record<string, OverviewTeam>): CupAtAGlanceView {
    const { most_picked: picked, most_banned: banned, first_ban: first, picker, fastest_team: fastest,
        best_defence: defence, biggest_upset: upset, most_comebacks: comebacks } = records
    const loser = upset && teams[upset.loser_id]
    const mapTiles = [
        picked && { label: 'Most picked', value: `${picked.picks}`, map: picked, note: `pick${plural(picked.picks)} · played ${picked.played} time${plural(picked.played)}` },
        banned && { label: 'Most banned', value: `${banned.bans}`, map: banned, note: `ban${plural(banned.bans)} · ${banned.first_bans} of them the first ban` },
        first && { label: 'Banned first most', value: `${first.first_bans}`, map: first, note: `first ban${plural(first.first_bans)} · still played ${first.played} time${plural(first.played)}` },
        picker && { label: 'Picking your map', value: `${Math.round(picker.rate * 100)}%`, subject: 'of picked maps won by the picker', note: `${picker.wins} of ${picker.games} map${plural(picker.games)}` },
    ]
    const teamTiles = [
        fastest && { label: 'Fastest team', value: paceText(fastest.value), team: teams[fastest.team_id], note: `median run vs the cup median on the same map · ${fastest.runs} run${plural(fastest.runs)}` },
        defence && { label: 'Fewest caps conceded', value: `${defence.caps_against}`, team: teams[defence.team_id], note: `cap${plural(defence.caps_against)} against in ${defence.maps} map${plural(defence.maps)}` },
        upset && loser && {
            label: 'Biggest upset',
            value: `#${upset.winner_seed}`,
            suffix: `beat #${upset.loser_seed}`,
            team: teams[upset.winner_id],
            note: `${upset.score.winner}–${upset.score.loser}`,
            upset: { loser, matchId: upset.match_id },
        },
        comebacks && { label: 'Most comebacks', value: `${comebacks.count}`, team: teams[comebacks.team_id], note: `map${plural(comebacks.count)} won after the opponent capped first` },
    ]
    const shown = (tiles: (GlanceTile | null | undefined)[]) => tiles.filter((tile): tile is GlanceTile => !!tile && (!('team' in tile) || !!tile.team))
    const view = { backdropMap: picked?.map ?? null, mapTiles: shown(mapTiles), teamTiles: shown(teamTiles) }
    return { ...view, emptyText: view.mapTiles.length + view.teamTiles.length ? null : GLANCE_EMPTY_TEXT }
}

const LABEL = 'text-[10px] uppercase tracking-wider text-muted-foreground'

function TeamSubject({ team, eventSlug }: { team: OverviewTeam; eventSlug: string }) {
    return (
        <OverviewTeamLink team={team} eventSlug={eventSlug} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <TeamAvatars members={team.members} accent={teamAccentColor(team.accentSlot)} />
            <span className="min-w-0 break-words leading-tight" style={{ color: teamAccentColor(team.accentSlot) }}>{team.name}</span>
        </OverviewTeamLink>
    )
}

function Tile({ tile, eventSlug }: { tile: GlanceTile; eventSlug: string }) {
    const { map, team, upset } = tile
    return (
        <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-hairline/10 bg-hairline/5 p-3">
            <div className={LABEL}>{tile.label}</div>
            <div className="text-3xl font-black leading-none tabular-nums text-foreground">
                {tile.value}
                {tile.suffix && <span className="ml-1 text-sm font-semibold text-muted-foreground">{tile.suffix}</span>}
            </div>
            {map && (
                <MapName map={map.map} name={map.display_name} wrap className="text-sm" />
            )}
            {team && <TeamSubject team={team} eventSlug={eventSlug} />}
            {tile.subject && <span className="text-sm font-semibold text-foreground">{tile.subject}</span>}
            <p className="text-xs text-muted-foreground">
                {upset ? (
                    <>
                        {tile.note} over <OverviewTeamLink team={upset.loser} eventSlug={eventSlug} /> ·{' '}
                        <PickBanLink eventSlug={eventSlug} matchId={upset.matchId} className="inline-flex cursor-pointer items-center gap-1 font-semibold text-accent-300 hover:underline underline-offset-4">
                            Pick & ban
                            <ArrowUpRight className="size-3.5" aria-hidden />
                        </PickBanLink>
                    </>
                ) : tile.note}
            </p>
        </div>
    )
}

function TileGroup({ label, tiles, eventSlug }: { label: string; tiles: GlanceTile[]; eventSlug: string }) {
    if (tiles.length === 0) return null
    return (
        <div className="flex flex-col gap-2">
            <h3 className={LABEL}>{label}</h3>
            <div className="glance-tiles grid gap-2.5">
                {tiles.map(tile => <Tile key={tile.label} tile={tile} eventSlug={eventSlug} />)}
            </div>
        </div>
    )
}

export function CupAtAGlance({ records, teams, eventSlug }: {
    records: EventStatsRecords
    teams: Record<string, OverviewTeam>
    eventSlug: string
}) {
    const view = cupAtAGlanceView(records, teams)
    const headingId = useId()

    return (
        <section aria-labelledby={headingId} className="glance relative isolate overflow-hidden rounded-xl border border-hairline/15">
            {view.backdropMap && (
                <img
                    src={derivedScreenshotUrl(view.backdropMap, SCREENSHOT_SIZE_PX.card)}
                    alt=""
                    decoding="async"
                    className="absolute inset-0 -z-10 size-full scale-125 object-cover opacity-40 blur-2xl"
                />
            )}
            <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h2 id={headingId} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-yellow-300">
                        <Timer className="size-4" aria-hidden />
                        Cup at a glance
                    </h2>
                    {!view.emptyText && <span className="text-xs text-muted-foreground">Fastest cup run per map is in the map table below</span>}
                </div>
                {view.emptyText && <p className="text-sm text-muted-foreground">{view.emptyText}</p>}
                <TileGroup label="Pick & ban" tiles={view.mapTiles} eventSlug={eventSlug} />
                <TileGroup label="Teams" tiles={view.teamTiles} eventSlug={eventSlug} />
            </div>
        </section>
    )
}
