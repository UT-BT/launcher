# Home dashboard

The `home` page-view: which widgets render for whom, how the page loads, caches and
refreshes, the feed contract behind each widget and the rules they follow. Read it before
touching `app/components/pages/Home.tsx` or `app/components/pages/home/`.

Elsewhere: the Medal Hunt endpoint is in [api.md](../api.md); prediction markets behind the
closing-soon strip in [events.md](events.md); the two-up layout rule in
[web-target.md](../web-target.md); why a child's data must sit in the page's `caches` in
[state-patterns.md](../state-patterns.md); server favorites storage in [api.md](../api.md);
the seasonal ambient layer (Home only) in [styling.md](../styling.md).

## Where the code lives

| Path | Holds |
|---|---|
| `app/components/pages/Home.tsx` | the page: `HomePageCaches`, the main parallel load, Refresh, the layout, the modals, Join/Spec through `useServerJoin` |
| `home/SpotlightSection.tsx` | the section frame: title, tick colour (from `ACCENTS` in `Home.tsx`), optional "See All" `NavLink` |
| `home/YouDoorway.tsx`, `CommunityStatsRow.tsx` | top row: profile card with Change title; Players and Maps totals with online / new links |
| `home/PersonalProgressSnapshot.tsx`, `capItAllProgress.ts` | Your Progress tiles; the Cap It All rank lookup and its cache type |
| `home/AchievementProgressPreview.tsx` | the six achievements closest to their next tier |
| `home/MedalHuntCard.tsx` | Medal Hunt: client-side filters, sort and paging, hidden maps, replay picker |
| `app/utils/medalHunt.ts` | pure row normalisation; `medalHunt.fixture.json` + `medalHunt.test.ts` pin the server contract |
| `home/FavoriteServersCard.tsx` | favorite servers that are live, with ping and Join / Spec |
| `home/HottestPosterGrid.tsx`, `NewestMapsCard.tsx`, `MapsToReviewCard.tsx` | map poster grid and map lists |
| `home/LatestRecordsCard.tsx`, `RecentCapsCard.tsx` | `DataTable` widgets with compact card rows |
| `home/news/` | `NewsCard`, `ArticleCard`, `CategoryChip`; also used by the News pages and Admin → News |
| `home/ClosingSoonBanner.tsx` | the "Predictions closing" strip |

## What renders for whom

Signed in, top to bottom, two widgets per row:

1. Closing-soon strip (only while a market closes soon)
2. You doorway · community stats
3. Latest News (only when there is news) · Your Favorite Servers
4. Your Progress · Achievement Progress
5. Medal Hunt · Hottest Maps
6. Newest Maps · Maps to Review
7. Latest World Records · Your Latest Caps

Signed out on the web: a "Make UTBT yours" sign-in strip and the community stats, then
`anonymousSections` (Latest News when present, Your Favorite Servers as a sign-in prompt,
Hottest Maps, Newest Maps, Latest World Records), two-up with the last one widened when the
count is odd. On desktop (no `capabilities.anonymousBrowse`) a signed-out Home shows only a
log-in message.

Personal widgets live only in the signed-in branch and take `userProfile.accessToken`.

## Loading, caching, refresh

- `HomePageCaches` and `DEFAULT_HOME_CACHES` live in `Home.tsx` (Home is eager, so no
  `.types.ts` file is needed) and are one singleton in `Main.tsx`.
- **One main load.** `loadData` runs `fetchSummary`, `fetchHotMaps`, `fetchNews`,
  `fetchNewsCategories`, `fetchGatewayServers` and `fetchUserSummary` in one `Promise.all`.
  Only `fetchSummary` can fail the page, and only when nothing is cached (full-page error with
  Try Again). Every other feed has a `.catch` to an empty value, so it degrades its own widget.
- **Cached data renders at once and the main load runs anyway** (stale-while-revalidate).
- **Self-fetching widgets keep their data in `caches`**: Medal Hunt rows (`medalHunt`), the
  community counts (`mapsCount`, `playersCount`), the first Maps to Review page
  (`pendingReviews`) and the Cap It All progress (`capItAllProgress`). Medal Hunt refetches
  in the background on every mount. The counts and the first review page are served from
  cache without a refetch until Refresh clears them.
- **Not cached**: the closing-soon strip (refetched each mount), Maps to Review pages after
  the first, and Medal Hunt's filters, sort and page (component state, reset on every visit).
- **Achievement Progress reads `achievementsCaches`** from `Main.tsx`, shared with the
  Achievements page through the single-flight `ensureAchievements`: fetched once per sign-in,
  forced by Refresh.
- **Refresh** is throttled by `useRefreshCooldown` (3 s). It nulls `medalHunt`,
  `mapsCount`, `playersCount`, `pendingReviews` and `capItAllProgress`, reruns `loadData`,
  forces achievements, and bumps `refreshKey` / `reviewsRefreshKey`, which children watch.
- **Per-user cached data names its owner.** `capItAllProgress` stores `userId` and `alias`;
  Home ignores it when they differ from the signed-in profile, and it expires after
  `CAP_IT_ALL_CACHE_MS` (5 min).
- A submitted review (`ReviewModal.onSuccess`) reruns `loadData` and bumps
  `reviewsRefreshKey`, but `MapsToReviewCard` serves a cached first page without fetching,
  so the reviewed map stays listed until Refresh.

## Feed contract

- `GET /v2/summary/` (`fetchSummary`) is the main feed.
  - **`achievements` is the viewer's recent caps** (Your Latest Caps), not achievements. A
    team cap carries `isTeam` and `teamCapId`: open it with `openTeamCap(teamCapId)`, a solo
    cap with `openCap(id)`.
  - **`recentWorldRecords`**: a row with a non-empty `members` is a team record and its `id`
    is the team cap id (`openTeamCap`); render the members with `TeamAvatarStack`.
  - `global.newMaps` is the "(n new)" count that opens Maps with `mapsNewOnly`.
- `GET /v2/summary/hot_maps` (`fetchHotMaps`) → `HotMap[]` with `ingameSeconds` and
  `spectateSeconds`; the grid shows the first six.
- `GET /v2/summary/pending_reviews?limit&offset` (`fetchPendingReviews`) →
  `{ total, items }`, paged by the server, five per page on Home.
- `GET /v2/summary/user/<id>` (`fetchUserSummary`) → `medals` and `counts` for Your Progress
  and the doorway's WR pill.
- Medal Hunt: [api.md](../api.md). Upcoming prediction markets: [events.md](events.md).

## Widget rules

### Your Progress

Nine tiles from `fetchUserSummary` plus Cap It All rank and team maps capped. A rank of `0`
reads "Unranked".

The API has no per-user Cap It All lookup, so `fetchCapItAllProgress` searches
`/v2/leaderboards/cap_it_all` by the summary profile's alias (at most three pages of 50) and
matches the row by user id. It starts only after the main load settles and aborts after 10 s.
Not found, ambiguous or failed gives `null`, shown as `—` with "Currently unavailable", never
a made-up zero or rank. This lookup stands in for a missing API field: ask for the field
instead of adding another lookup like it (hard rule 8).

### Achievement Progress

Drops maxed and tierless rows and event achievements that can no longer be won or are awarded
at the end ([events.md](events.md)), sorts by `percent_to_next` and shows six. Team
achievements carry a Team chip.

### Medal Hunt

- Medal and improvement-window filters, sort (default: most recently lost world record
  first), and a page size of 4, 6 or 8 chosen from the card width and window height, all
  client-side.
- Hiding a map writes `utbt:homeMedalHuntHidden:v1:<userId>` with `setSynced` from
  `app/utils/userState.ts`, so it follows the account; the card subscribes, so a change from
  another device applies live. Key rules: [state-patterns.md](../state-patterns.md).
- A failed fetch with no cached rows shows the empty state; with cached rows it keeps them.

### Favorite servers

- Lists only favorites present in the live gateway server list; when none is,
  it says so instead of listing offline entries.
- Ping runs once per unique IP over IPC when `capabilities.ping`. Join and Spec render only
  with `capabilities.game` and enable on `installationStatus === 'valid'` (Join also needs a
  free slot).
- Join and Spec call `useServerJoin`, the same hook the server browser uses; Home shows its
  notice (launch error or game already running) in a modal. The behaviour is in
  [game.md](game.md).
- `installationStatus` reaches Home only through `case 'home'` in `Main.tsx`, not the
  `default` case.

### News

`NewsCard` shows the five newest, sized to show two and scroll. An article gets the New pill
when `publishedAt > newSince`. `Main.tsx` passes that marker (`newsSeenIso`) only from its
`default` case, so the `home` view renders no New pill.

### Closing-soon strip

`fetchUpcomingPredictions({ limit: 4, withinHours: 3 })`, signed in only. It is a strip, not a
section, and renders nothing when no market is open, so it leaves no hole on most days. The
countdown turns amber inside 30 minutes; each entry links to the event's Predictions tab.
Market and locking rules: [events.md](events.md).

### Community stats

Players total (`fetchPlayersCount`) with "online" summed from the gateway servers'
`player_count`; Maps total (`fetchMapsCount`) with the new-maps count. A failed count stays a
skeleton.

## Layout rules

- Every section is a `SpotlightSection` with its tick colour in `ACCENTS`. Give "See All" an
  `actionView` so it renders as a real link on the web.
- Pair sections two-up (`lg:col-span-6`) and widen a section to `lg:col-span-12` when its
  partner is conditional ([web-target.md](../web-target.md)).
- Each widget draws its own loading and empty states inside the card shell
  (`bg-card/30 border border-hairline/5 rounded-xl`, an icon and one line). Only the
  closing-soon strip returns `null`.
- Bound each widget's height so paired sections stay level: lists cap at five rows, Medal Hunt
  and Maps to Review page, News shows two and scrolls, Favorite servers scrolls past a max
  height, Achievement Progress scrolls below `sm`.
- Latest World Records and Your Latest Caps are `DataTableShell` tables with `responsive`
  columns and `compactContent`; keep their time labels on one line (`whitespace-nowrap`).

## Adding a Home widget

Widgets are added one at a time (Your Progress and Achievement Progress, Medal Hunt,
Favorite Servers, the Cap It All tiles). Steps, from how those landed:

1. **Component**: `app/components/pages/home/<Name>Card.tsx`. If its data comes from the main
   load, keep it presentational (copy `NewestMapsCard`). If it has its own endpoint, it fetches
   for itself with a cached slice (copy the `rows` / `onRowsLoaded` / `refreshKey` fetch effect
   in `MedalHuntCard`).
2. **Fetcher** in `app/utils/api.ts` (skill: consume-api-data). Data every visitor needs goes
   into `loadData`'s `Promise.all` with a `.catch` fallback, so it can never fail Home.
3. **Cache**: add the slice to `HomePageCaches` and `DEFAULT_HOME_CACHES`, and write it
   through an `on<Name>Loaded` callback wrapped in `useCallback` (the child's fetch effect
   depends on it). Store the owner's id with per-user data. Render the cached value and
   refetch on mount anyway.
4. **Refresh**: clear the slice in the `useRegisterPageRefresh` handler and pass
   `refreshKey` to the widget.
5. **Place it**: wrap it in `SpotlightSection` with a new `ACCENTS` entry, in a two-up row.
   A public widget becomes a `render<Name>Section(span)` used in both branches and added to
   `anonymousSections`; a personal one goes only in the signed-in branch.
6. **States**: loading and empty states inside the card shell; bounded height.
7. **Verify**: `npm run typecheck:web` and `npm test` pass; in `npm run dev:web` the widget
   renders signed out and signed in at 390 px and 1920 px with no horizontal scroll; and
   `npx playwright test e2e/responsive-accessibility.spec.ts` passes (it renders `/` against a
   mocked API).
