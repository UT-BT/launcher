# Mobile routes

Every entry of the mobile route manifest (`e2e/mobile/manifest/`), with the surfaces the mobile
crawl opens for it ([testing.md](testing.md#mobile-route-manifest)). This file is generated:
don't edit it by hand. After changing the manifest, run `npm run docs:mobile-routes`;
`npm run docs:check` fails while this file no longer matches the manifest.

A surface id keys the crawl's test titles, the ledger and the gallery. A sub-view is reached by
its URL or by a step on the entry's page. A stress variant adds `~<variant>` to a surface id:
the PR subset crawls the variant named here, the full matrix every variant. A skipped rule
doesn't run on the surfaces it names.

| Entry | View | Tier | Path | Fixture set | Sub-views | Modals |
|---|---|---|---|---|---|---|
| `home` | `home` | public | `/` | `home` | 0 | 2 |
| `servers` | `servers` | public | `/servers` | `servers` | 0 | 1 |
| `maps` | `maps` | public | `/maps` | `maps` | 1 | 3 |
| `maps-detail` | `maps-detail` | public | `/maps/CTF-BT-HumanResources` | `maps-detail` | 3 | 7 |
| `players` | `players` | public | `/players` | `players` | 0 | 1 |
| `player-detail` | `player-detail` | public | `/players/778035658224697377` | `player-detail` | 7 | 5 |
| `teams` | `teams` | public | `/teams` | `teams` | 0 | 0 |
| `team-detail` | `team-detail` | public | `/teams/9ca5c141-f968-4bf1-b05f-2bd2af0611b3` | `team-detail` | 0 | 0 |
| `events` | `events` | public | `/events` | `events` | 0 | 0 |
| `event-detail` | `event-detail` | public | `/events/2v2-cup-2026` | `event-detail` | 6 | 1 |
| `match-pickban` | `match-pickban` | public | `/events/2v2-cup-2026/matches/673d41c0-0ad0-4fdb-8f41-eeb1cb108934` | `match-pickban` | 0 | 0 |
| `event-team` | `event-team` | public | `/events/2v2-cup-2026/teams/01c942d8-95ac-49cd-85be-791b18e24b86` | `event-team` | 0 | 0 |
| `world-records` | `world-records` | public | `/world-records` | `world-records` | 1 | 2 |
| `cap-it-all` | `cap-it-all` | public | `/cap-it-all` | `cap-it-all` | 0 | 0 |
| `cap-detail` | `cap-detail` | public | `/caps/258021df-51b1-4ed3-99cc-62d4e75892a7` | `cap-detail` | 0 | 3 |
| `team-cap-detail` | `team-cap-detail` | public | `/team-caps/2ac2a87f-1030-45ed-b281-bdcbf926717d` | `team-cap-detail` | 0 | 2 |
| `achievements` | `achievements` | public | `/achievements` | `achievements` | 0 | 0 |
| `news` | `news` | public | `/news` | `news` | 0 | 0 |
| `news-detail` | `news-detail` | public | `/news/15` | `news-detail` | 0 | 0 |
| `run-compare` | `run-compare` | public | `/compare?runs=258021df-51b1-4ed3-99cc-62d4e75892a7,418b0aec-34c5-40e7-acf4-f2bc33373063` | `run-compare` | 0 | 1 |
| `home:signed-in` | `home` | role-gated | `/` | `home-signed-in` | 0 | 2 |
| `maps:signed-in` | `maps` | role-gated | `/maps` | `maps-signed-in` | 0 | 0 |
| `admin` | `admin` | role-gated | `/admin` | `admin` | 19 | 4 |
| `event-detail:manager` | `event-detail` | role-gated | `/events/test-cup-manage?tab=manage` | `event-manager` | 7 | 1 |
| `match-pickban:captain` | `match-pickban` | role-gated | `/events/test-cup-pickban/matches/5d0c8e2a-7b41-5f93-a6d2-3e9f10b7c4a1` | `match-pickban-captain` | 0 | 0 |
| `match-pickban:manager` | `match-pickban` | role-gated | `/events/test-cup-pickban/matches/5d0c8e2a-7b41-5f93-a6d2-3e9f10b7c4a1` | `match-pickban-manager` | 0 | 0 |

## home

- **View:** `home`
- **Tier:** public
- **Path:** `/`
- **Fixture set:** `home`
- **Stress variant (PR subset):** `long-text`
- **Decorative columns:** none

### Sub-views

No sub-views.

### Modals

| Surface | Label | Opened from |
|---|---|---|
| `home/watch-replay` | Replay video | `home` |
| `home/consent-privacy-policy` | Analytics consent › Privacy policy | `home` |

### Skipped rules

No skipped rules.

## servers

- **View:** `servers`
- **Tier:** public
- **Path:** `/servers`
- **Fixture set:** `servers`
- **Stress variant (PR subset):** `long-text`
- **Decorative columns:** `column 1`

### Sub-views

No sub-views.

### Modals

| Surface | Label | Opened from |
|---|---|---|
| `servers/tutorial` | Servers tutorial | `servers` |

### Skipped rules

No skipped rules.

## maps

- **View:** `maps`
- **Tier:** public
- **Path:** `/maps`
- **Fixture set:** `maps`
- **Stress variant (PR subset):** `most-columns`
- **Decorative columns:** `column 1`

### Sub-views

| Surface | Label | Reached by | Stress variant (PR subset) |
|---|---|---|---|
| `maps/new` | New maps only | URL `/maps?new=1` | none |

### Modals

| Surface | Label | Opened from |
|---|---|---|
| `maps/tutorial` | Maps tutorial | `maps` |
| `maps/demos` | Demos | `maps` |
| `maps/reviews` | Map reviews | `maps` |

### Skipped rules

No skipped rules.

## maps-detail

- **View:** `maps-detail`
- **Tier:** public
- **Path:** `/maps/CTF-BT-HumanResources`
- **Fixture set:** `maps-detail`
- **Stress variant (PR subset):** `long-text`
- **Decorative columns:** none

### Sub-views

| Surface | Label | Reached by | Stress variant (PR subset) |
|---|---|---|---|
| `maps-detail/certified` | Certified leaderboard | a step on `/maps/CTF-BT-HumanResources` | none |
| `maps-detail/all` | All caps leaderboard | a step on `/maps/CTF-BT-HumanResources` | none |
| `maps-detail/team-map` | Team map | URL `/maps/CTF-BT-II-SkaarjInvasion-vF2` | `most-columns` |

### Modals

| Surface | Label | Opened from |
|---|---|---|
| `maps-detail/playtime` | Playtime breakdown | `maps-detail` |
| `maps-detail/cap-distribution` | Cap time distribution | `maps-detail` |
| `maps-detail/wr-progression` | World record progression | `maps-detail` |
| `maps-detail/watch-run` | Replay video | `maps-detail` |
| `maps-detail/sign-in-to-review` | Sign in to review | `maps-detail` |
| `maps-detail/screenshot-viewer` | Screenshot viewer | `maps-detail` |
| `maps-detail/team-map/team-cap-distribution` | Team time distribution | `maps-detail/team-map` |

### Skipped rules

No skipped rules.

## players

- **View:** `players`
- **Tier:** public
- **Path:** `/players`
- **Fixture set:** `players`
- **Stress variant (PR subset):** `long-text`
- **Decorative columns:** none

### Sub-views

No sub-views.

### Modals

| Surface | Label | Opened from |
|---|---|---|
| `players/tutorial` | Players tutorial | `players` |

### Skipped rules

No skipped rules.

## player-detail

- **View:** `player-detail`
- **Tier:** public
- **Path:** `/players/778035658224697377`
- **Fixture set:** `player-detail`
- **Stress variant (PR subset):** `single-row`
- **Decorative columns:** none

### Sub-views

| Surface | Label | Reached by | Stress variant (PR subset) |
|---|---|---|---|
| `player-detail/disallowed` | Disallowed | a step on `/players/778035658224697377` | none |
| `player-detail/personal-bests` | Personal Bests | a step on `/players/778035658224697377` | `long-text` |
| `player-detail/world-records` | World Records | a step on `/players/778035658224697377` | `most-columns` |
| `player-detail/playtime` | Playtime by Map | a step on `/players/778035658224697377` | none |
| `player-detail/uncapped` | Uncapped Maps | a step on `/players/778035658224697377` | none |
| `player-detail/achievements` | Achievements | a step on `/players/778035658224697377` | none |
| `player-detail/maps-authored` | Maps Authored | a step on `/players/778035658224697377` | none |

### Modals

| Surface | Label | Opened from |
|---|---|---|
| `player-detail/reviews-written` | Reviews written | `player-detail` |
| `player-detail/favorite-maps` | Favorite maps | `player-detail` |
| `player-detail/watch-run` | Replay video | `player-detail` |
| `player-detail/personal-bests/watch-run` | Replay video | `player-detail/personal-bests` |
| `player-detail/world-records/wr-progression` | World record progression | `player-detail/world-records` |

### Skipped rules

No skipped rules.

## teams

- **View:** `teams`
- **Tier:** public
- **Path:** `/teams`
- **Fixture set:** `teams`
- **Stress variant (PR subset):** `most-columns`
- **Decorative columns:** none

### Sub-views

No sub-views.

### Modals

No modals.

### Skipped rules

No skipped rules.

## team-detail

- **View:** `team-detail`
- **Tier:** public
- **Path:** `/teams/9ca5c141-f968-4bf1-b05f-2bd2af0611b3`
- **Fixture set:** `team-detail`
- **Stress variant (PR subset):** `long-text`
- **Decorative columns:** none

### Sub-views

No sub-views.

### Modals

No modals.

### Skipped rules

No skipped rules.

## events

- **View:** `events`
- **Tier:** public
- **Path:** `/events`
- **Fixture set:** `events`
- **Stress variant (PR subset):** `empty`
- **Decorative columns:** none

### Sub-views

No sub-views.

### Modals

No modals.

### Skipped rules

No skipped rules.

## event-detail

- **View:** `event-detail`
- **Tier:** public
- **Path:** `/events/2v2-cup-2026`
- **Fixture set:** `event-detail`
- **Stress variant (PR subset):** none
- **Decorative columns:** none

### Sub-views

| Surface | Label | Reached by | Stress variant (PR subset) |
|---|---|---|---|
| `event-detail/teams` | Stats | URL `/events/2v2-cup-2026?tab=teams` | `long-text` |
| `event-detail/bracket` | Bracket | URL `/events/2v2-cup-2026?tab=bracket` | none |
| `event-detail/maps` | Maps | URL `/events/2v2-cup-2026?tab=maps` | none |
| `event-detail/schedule` | Schedule | URL `/events/2v2-cup-2026?tab=schedule` | none |
| `event-detail/predictions` | Predictions | URL `/events/2v2-cup-2026?tab=predictions` | none |
| `event-detail/achievements` | Achievements | URL `/events/2v2-cup-2026?tab=achievements` | none |

### Modals

| Surface | Label | Opened from |
|---|---|---|
| `event-detail/predictions/backers` | Backers | `event-detail/predictions` |

### Skipped rules

No skipped rules.

## match-pickban

- **View:** `match-pickban`
- **Tier:** public
- **Path:** `/events/2v2-cup-2026/matches/673d41c0-0ad0-4fdb-8f41-eeb1cb108934`
- **Fixture set:** `match-pickban`
- **Stress variant (PR subset):** none
- **Decorative columns:** none

### Sub-views

No sub-views.

### Modals

No modals.

### Skipped rules

No skipped rules.

## event-team

- **View:** `event-team`
- **Tier:** public
- **Path:** `/events/2v2-cup-2026/teams/01c942d8-95ac-49cd-85be-791b18e24b86`
- **Fixture set:** `event-team`
- **Stress variant (PR subset):** `long-text`
- **Decorative columns:** none

### Sub-views

No sub-views.

### Modals

No modals.

### Skipped rules

No skipped rules.

## world-records

- **View:** `world-records`
- **Tier:** public
- **Path:** `/world-records`
- **Fixture set:** `world-records`
- **Stress variant (PR subset):** `most-columns`
- **Decorative columns:** none

### Sub-views

| Surface | Label | Reached by | Stress variant (PR subset) |
|---|---|---|---|
| `world-records/rushers` | Top Rushers | a step on `/world-records` | `long-text` |

### Modals

| Surface | Label | Opened from |
|---|---|---|
| `world-records/wr-progression` | World record progression | `world-records` |
| `world-records/watch-run` | Replay video | `world-records` |

### Skipped rules

No skipped rules.

## cap-it-all

- **View:** `cap-it-all`
- **Tier:** public
- **Path:** `/cap-it-all`
- **Fixture set:** `cap-it-all`
- **Stress variant (PR subset):** `long-text`
- **Decorative columns:** none

### Sub-views

No sub-views.

### Modals

No modals.

### Skipped rules

No skipped rules.

## cap-detail

- **View:** `cap-detail`
- **Tier:** public
- **Path:** `/caps/258021df-51b1-4ed3-99cc-62d4e75892a7`
- **Fixture set:** `cap-detail`
- **Stress variant (PR subset):** none
- **Decorative columns:** none

### Sub-views

No sub-views.

### Modals

| Surface | Label | Opened from |
|---|---|---|
| `cap-detail/compare-run` | Compare run picker | `cap-detail` |
| `cap-detail/compare-runs` | Compare runs video | `cap-detail` |
| `cap-detail/watch-replay` | Replay video | `cap-detail` |

### Skipped rules

No skipped rules.

## team-cap-detail

- **View:** `team-cap-detail`
- **Tier:** public
- **Path:** `/team-caps/2ac2a87f-1030-45ed-b281-bdcbf926717d`
- **Fixture set:** `team-cap-detail`
- **Stress variant (PR subset):** none
- **Decorative columns:** none

### Sub-views

No sub-views.

### Modals

| Surface | Label | Opened from |
|---|---|---|
| `team-cap-detail/watch-team-replay` | Team replay video | `team-cap-detail` |
| `team-cap-detail/watch-member-replay` | Member replay video | `team-cap-detail` |

### Skipped rules

No skipped rules.

## achievements

- **View:** `achievements`
- **Tier:** public
- **Path:** `/achievements`
- **Fixture set:** `achievements`
- **Stress variant (PR subset):** none
- **Decorative columns:** none

### Sub-views

No sub-views.

### Modals

No modals.

### Skipped rules

No skipped rules.

## news

- **View:** `news`
- **Tier:** public
- **Path:** `/news`
- **Fixture set:** `news`
- **Stress variant (PR subset):** `single-row`
- **Decorative columns:** none

### Sub-views

No sub-views.

### Modals

No modals.

### Skipped rules

No skipped rules.

## news-detail

- **View:** `news-detail`
- **Tier:** public
- **Path:** `/news/15`
- **Fixture set:** `news-detail`
- **Stress variant (PR subset):** none
- **Decorative columns:** none

### Sub-views

No sub-views.

### Modals

No modals.

### Skipped rules

No skipped rules.

## run-compare

- **View:** `run-compare`
- **Tier:** public
- **Path:** `/compare?runs=258021df-51b1-4ed3-99cc-62d4e75892a7,418b0aec-34c5-40e7-acf4-f2bc33373063`
- **Fixture set:** `run-compare`
- **Stress variant (PR subset):** none
- **Decorative columns:** none

### Sub-views

No sub-views.

### Modals

| Surface | Label | Opened from |
|---|---|---|
| `run-compare/runs` | Runs drawer | `run-compare` |

### Skipped rules

No skipped rules.

## home:signed-in

- **View:** `home`
- **Tier:** role-gated
- **Path:** `/`
- **Fixture set:** `home-signed-in`
- **Stress variant (PR subset):** none
- **Decorative columns:** `column 1`

### Sub-views

No sub-views.

### Modals

| Surface | Label | Opened from |
|---|---|---|
| `home:signed-in/history` | Recent caps history | `home:signed-in` |
| `home:signed-in/settings` | Settings | `home:signed-in` |

### Skipped rules

No skipped rules.

## maps:signed-in

- **View:** `maps`
- **Tier:** role-gated
- **Path:** `/maps`
- **Fixture set:** `maps-signed-in`
- **Stress variant (PR subset):** none
- **Decorative columns:** `column 1`

### Sub-views

No sub-views.

### Modals

No modals.

### Skipped rules

No skipped rules.

## admin

- **View:** `admin`
- **Tier:** role-gated
- **Path:** `/admin`
- **Fixture set:** `admin`
- **Stress variant (PR subset):** none
- **Decorative columns:** none

### Sub-views

| Surface | Label | Reached by | Stress variant (PR subset) |
|---|---|---|---|
| `admin/usage-health` | Usage & Health | a step on `/admin` | none |
| `admin/user-management` | User Management | a step on `/admin` | none |
| `admin/title-management` | Title Management | a step on `/admin` | none |
| `admin/news-management` | News | a step on `/admin` | none |
| `admin/events-management` | Events | a step on `/admin` | none |
| `admin/formats-management` | Tournament Formats | a step on `/admin` | none |
| `admin/streamers` | Streamers | a step on `/admin` | none |
| `admin/caps-management` | Caps Management | a step on `/admin` | none |
| `admin/maps-management` | Maps Management | a step on `/admin` | none |
| `admin/map-uploads` | Map Uploads | a step on `/admin` | none |
| `admin/map-uploads-publishing` | Map Uploads › Publishing / Recent | a step on `/admin` | none |
| `admin/map-uploads-drift` | Map Uploads › Drift | a step on `/admin` | none |
| `admin/patches-management` | Patch Releases | a step on `/admin` | none |
| `admin/anti-cheat` | Anti-Cheat | a step on `/admin` | none |
| `admin/anti-cheat-cap-delta` | Anti-Cheat › High Cap Delta | a step on `/admin` | none |
| `admin/anti-cheat-low-fps` | Anti-Cheat › Low FPS WRs | a step on `/admin` | none |
| `admin/audit-logs` | Audit Logs | a step on `/admin` | none |
| `admin/role-management` | Staff Roles | a step on `/admin` | none |
| `admin/hosts-management` | Game Hosts | a step on `/admin` | none |

### Modals

| Surface | Label | Opened from |
|---|---|---|
| `admin/maps-management/difficulty-sync` | Difficulty Sync | `admin/maps-management` |
| `admin/maps-management/map-authors` | Map authors | `admin/maps-management` |
| `admin/maps-management/map-authors-linked` | Map authors › Linked players | `admin/maps-management` |
| `admin/anti-cheat/shared-detail` | Shared identifier detail | `admin/anti-cheat` |

### Skipped rules

No skipped rules.

## event-detail:manager

- **View:** `event-detail`
- **Tier:** role-gated
- **Path:** `/events/test-cup-manage?tab=manage`
- **Fixture set:** `event-manager`
- **Stress variant (PR subset):** none
- **Decorative columns:** none

### Sub-views

| Surface | Label | Reached by | Stress variant (PR subset) |
|---|---|---|---|
| `event-detail:manager/format` | Manage › Format | a step on `/events/test-cup-manage?tab=manage` | none |
| `event-detail:manager/bracket` | Manage › Bracket | a step on `/events/test-cup-manage?tab=manage` | none |
| `event-detail:manager/matches` | Manage › Matches | a step on `/events/test-cup-manage?tab=manage` | none |
| `event-detail:manager/pickban` | Manage › Picks & Bans | a step on `/events/test-cup-manage?tab=manage` | none |
| `event-detail:manager/schedule` | Manage › Schedule | a step on `/events/test-cup-manage?tab=manage` | none |
| `event-detail:manager/predictions` | Manage › Predictions | a step on `/events/test-cup-manage?tab=manage` | none |
| `event-detail:manager/stream` | Stream | URL `/events/test-cup-manage?tab=stream` | none |

### Modals

| Surface | Label | Opened from |
|---|---|---|
| `event-detail:manager/matches/edit-match` | Edit match | `event-detail:manager/matches` |

### Skipped rules

No skipped rules.

## match-pickban:captain

- **View:** `match-pickban`
- **Tier:** role-gated
- **Path:** `/events/test-cup-pickban/matches/5d0c8e2a-7b41-5f93-a6d2-3e9f10b7c4a1`
- **Fixture set:** `match-pickban-captain`
- **Stress variant (PR subset):** none
- **Decorative columns:** none

### Sub-views

No sub-views.

### Modals

No modals.

### Skipped rules

No skipped rules.

## match-pickban:manager

- **View:** `match-pickban`
- **Tier:** role-gated
- **Path:** `/events/test-cup-pickban/matches/5d0c8e2a-7b41-5f93-a6d2-3e9f10b7c4a1`
- **Fixture set:** `match-pickban-manager`
- **Stress variant (PR subset):** none
- **Decorative columns:** none

### Sub-views

No sub-views.

### Modals

No modals.

### Skipped rules

No skipped rules.
