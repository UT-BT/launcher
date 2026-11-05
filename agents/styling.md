# Styling

The locked design tokens and class strings for every UI change: colours, themes,
tables, layout, buttons, forms, the sidebar, motion and the CSS runtime budget. When
you find drift, move the code onto these patterns rather than adding a variant. Which
component to render is in [shared-components.md](shared-components.md).

Feature styling lives with its feature: pick/ban sides and veto cards in
[pick-ban-ui.md](features/pick-ban-ui.md), event stats in
[events.md](features/events.md), broadcast and OBS scenes in
[stream-kit.md](features/stream-kit.md).

## Class merging

Compose conditional classes with `cn` from `lib/utils.ts` (clsx + tailwind-merge), so
a later class wins a Tailwind conflict:

```ts
cn('px-4 py-3', condition && 'px-2')  // → 'py-3 px-2'
```

## Colour tokens

Write colours with tokens that follow the theme, so every component works in the
dark themes and in Light without per-component edits:

| For | Use | Not |
|---|---|---|
| Primary text | `text-foreground` | `text-white` |
| Secondary / inactive text | `text-muted-foreground` | `text-gray-*` |
| Borders, dividers, subtle fills | `*-hairline/<n>` (`border-hairline/10`, `bg-hairline/5`) | `white/<n>`, `border-gray-*` |
| Card and panel surfaces | `bg-card/<n>` | `bg-gray-*`, dark hex (`bg-[#0f1115]`) |
| Menus, popovers, `<option>`s | `bg-popover` | dark hex |
| Chrome accent | `accent-*` | `blue-*` |

`text-white` is right only on a solid coloured fill (`bg-accent-500 text-white` count
badges), which stays white in every theme. `white/<n>` survives in older event code;
new code uses `hairline`.

### The themeable scale: `accent-*`

`accent-50…950` is the only scale a theme changes. Use it for all chrome: primary
actions, active states, links, sort icons, count badges, CTAs, focus rings. Classic
(the default) is Tailwind blue.

### Fixed colours

These keep their literal Tailwind colour in every theme:

- **Functional**: destructive / errors `red-500` / `red-300`; positive / save
  `emerald-500` / `emerald-300`; warning `amber-300`, `rose-400` / `rose-300` (full
  server, demos); favourites `yellow-400`.
- **Game identity**: world record blue (`text-blue-300`); champion and rank-1 time
  red (`text-red-300`); medals bronze `amber-500`, silver `slate-200`, gold
  `yellow-300`; delta gained emerald, lost red (`DELTA_COLORS` in
  `app/components/pages/capDetail/capStats.ts`); roles (`app/utils/roles.ts`),
  Patreon, verified, certified, cap type, team and compare-runner A/B colours.
- **Brand moments**: splash, login and marketing gradients (`--utbt-*` in
  `app/styles/shared.css`); the gold desktop-app button, `promo-gold` in the `@theme`
  block of `app/styles/theme.css` with `text-amber-950` (the Light theme remaps
  `amber-300/400` to a dark text tone, so the fill can't use them; see
  [Desktop promotion](#desktop-promotion-web-only)).
- **Pick/ban sides**: team A crimson `pickban-a`, team B azure `pickban-b`, decider
  gold `pickban-gold`, defined once in the `@theme` block of `app/styles/theme.css`
  so every utility and opacity step works (`text-pickban-a`, `border-pickban-b/45`,
  `bg-pickban-gold/20`). Read them through `PICK_BAN_TONES`
  (`app/components/broadcast/broadcastTone.ts`); a gradient, glow or shadow takes the
  raw value from `PICK_BAN_HUES` and alpha from `tint(hue, percent)` in the same file.

Score and difficulty colours come from `app/utils/scoreColors.ts`; rarity and title
colours from `PlayerInfo` / `app/utils/titleStyles.ts`. Keep those thresholds in
those files.

## Themes

Themes swap CSS variable values only, with identical structure. Values live in
`app/styles/themes.css` (`:root` = Classic, `:root[data-theme='…']` for the rest);
the registry is `app/theme/themes.ts`, the provider `app/theme/ThemeProvider.tsx`
(key `utbt:theme:v1`). The picker is Settings → Appearance
(`LauncherAppearanceSettings.tsx`). Steps: [Adding a theme](#adding-a-theme).

What a theme sets:

- **Accent** `--accent-50…950` → `accent-*`.
- **Surface tint**: `--card`, `--background`, `--muted`, `--border` at Classic's
  lightness with a faint hue.
- **Glow** `--accent-glow-rgb` (space-separated RGB) for
  `drop-shadow-[…rgb(var(--accent-glow-rgb)/<a>)]` (the sidebar logo, count bubbles).
- **Nebula** `--nebula-1…4` (comma-separated RGB) are the gradient stops of the
  animated `.nebula-bg` backdrop in `shared.css`. A gradient theme sets all four, or
  it inherits Classic's blue swirl. Below `lg` and on touch screens (`hover: none`), in
  either orientation, the swirl layer is hidden and the glow layer stands still.
- **Hairline** `--hairline-rgb` backs `--color-hairline`: white on dark themes, dark
  in Light.
- **Window chrome**: the titlebar's `--window-c-*` vars in `app/styles/window.css`
  map to theme tokens (`--secondary`, `--popover`, `--foreground`, `--border`), so
  titlebar colours follow the theme without hard-coding.

`window.css` is desktop-only: only `renderer-desktop.tsx` imports it, through
`app/styles/desktop.css`. `color-scheme` lives in `globals.css` instead, because it
drives native form controls and scrollbars on both targets; moved into `window.css`
it silently breaks the website's `<select>` and scrollbars. The web entry sets
`--window-titlebar-height: 0px` before React mounts, which shared components
position against.

### Registry flags

- `group: 'gradients' | 'solid'` splits the picker. Solid themes (`light`, `black`,
  `slate-blue-squared`) hide `.nebula-bg` in `themes.css` for a flat background.
- `exclusive: true` gates the jewel themes (`aurum`, `amethyst`, `emerald`, `rose`)
  to Patreon supporters. `AppLayout` passes
  `unlockExclusive = patreonTier > 0 || utbt_role > 0` down to the picker, from data
  already loaded (no extra request). A locked card shows a lock and a Patreon tag and
  opens patreon.com/utbt. Staff unlock is silent: the card never mentions roles. The
  gate is soft by design; the CSS ships to everyone.
- `light: true` marks a light theme (`light`): it drops the `dark` class
  ([Light](#light)). Read it through `isLightTheme(id)` or `LIGHT_THEME_IDS`
  (`themes.ts`), never by comparing ids.
- `new: true` puts a neutral "New" chip on the theme's picker card, for one release. On
  `seasonal` it also keeps the Home [new-theme notice](#new-theme-notice) alive; removing it
  retires both.
- `slate-blue-squared` sets every `--radius-*` to 0. Keep radii on Tailwind's named
  scale so they follow it; `rounded-full` (avatars, pills) is off that scale and stays
  round.

### Light

`light` is the one theme flagged `light: true`, so it is the one that removes the `dark`
class (in `ThemeProvider` and the `app/index.html` pre-paint script); every other theme
keeps `.dark`, and `theme.css` defines `dark:` as class-based. The light `select` /
`option` rules in `themes.css` key off `:root:not(.dark)`, so they follow the flag.
`:root[data-theme='light']` flips the surface vars and
`--hairline-rgb`, uses an accent ramp whose text shades (`accent-200/300/400`) are
dark, and overrides the brand and functional text shades (`--color-blue-300`,
`--color-red-300`, …) to dark legible values. That flips every plain coloured text
utility. Opacity variants such as `text-blue-300/40` compile to a fixed colour and do
not flip; fix those per spot.

Player title colours are per-title RGB, computed in JS (`app/utils/titleStyles.ts`):
in a light theme (`isLightTheme`) they map to a darker, contrast-targeted tone without the
text outline.
`PlayerInfo` reads `useTheme`, so they update live.

### Seasonal theme

`seasonal` (label "Seasonal", gradients group, free, dark) is the one theme that follows the
year: a season's look, replaced by a holiday's look while the holiday runs. Classic and every
other theme keep their own palette all year; on them a holiday changes only the logo
([Logo on every theme](#logo-on-every-theme)). Seasonal never drops the `dark` class, and no
entry is a light look. The code is in `app/seasonal/`; the picker card is in Settings →
Appearance ([The Seasonal card](#the-seasonal-card)).

Its base block, `:root[data-theme='seasonal']` in `themes.css`, holds Classic's values
(`themes.test.ts` keeps them equal). It shows only when no entry resolves, which happens only
under a `none` preview (`?season=none`, or the e2e pin).

#### Entries

`ENTRIES` in `app/seasonal/seasons.ts` is the one registry of seasons and holidays. Each entry
has an `id`, a `label`, a `kind` (`season` or `holiday`), a `window(year, hemisphere)` that
returns `{ start, endExclusive }` (or `null` for a year it doesn't occur), an optional
`hemisphere` filter (`north` or `south`) and an optional `logo` alias (the entry whose logo it
shows). `EntryId`, `ENTRY_IDS`, the dev preview options, the logo lookup, the stylesheet check
and the e2e loop all derive from it; the pre-paint list is an inline copy that a test holds to it.
Registry order is the table's, and it breaks ties between holidays of the same width.

| Id | Label | Kind | Window (local date, inclusive) | Hemisphere |
|---|---|---|---|---|
| `spring` | Spring | season | North Mar 1 – May 31, South Sep 1 – Nov 30 | both |
| `summer` | Summer | season | North Jun 1 – Aug 31, South Dec 1 – Feb 28/29 | both |
| `autumn` | Autumn | season | North Sep 1 – Nov 30, South Mar 1 – May 31 | both |
| `winter` | Winter | season | North Dec 1 – Feb 28/29, South Jun 1 – Aug 31 | both |
| `new-year` | New Year | holiday | Dec 31 – Jan 3 | both |
| `lunar-new-year` | Lunar New Year | holiday | the eve of Lunar New Year's Day to five days after it | both |
| `valentines` | Valentine's Day | holiday | Feb 12 – 15 | both |
| `st-patricks` | St Patrick's Day | holiday | Mar 15 – 17 | both |
| `easter` | Easter | holiday | Western Easter Sunday ± 7 days (`easterSunday`) | both |
| `halloween` | Halloween | holiday | Oct 24 – Nov 7 | both |
| `christmas` | Christmas | holiday | Dec 18 – 30 | north |
| `christmas-summer` | Summer Christmas | holiday | Dec 18 – 30 | south, logo alias `christmas` |

- Seasons are meteorological whole months, and the southern window is the northern one six
  months on. A holiday's window is the same in both hemispheres.
- A window ends at the local midnight after its last day.
- Lunar New Year's Day comes from the date table in `app/seasonal/lunarNewYear.ts`
  (`lunarNewYearsDay`, `LUNAR_NEW_YEAR_YEARS`): 2026 through 2050, taken from the Hong Kong
  Observatory's Gregorian–Lunar calendar conversion tables (the "1st Lunar Month" date). Outside
  the table the holiday doesn't occur; `lunarNewYear.test.ts` pins the range and spot-checks
  years. Extend the table from the same source before 2050.

#### The appearance resolver

`resolveAppearance({ now, themeId, preview, timeZone, hemisphereSetting, hemispherePreview })`
in `app/seasonal/appearance.ts` is the one pure function that decides what shows. It returns
`{ seasonal, logo, until }`: the **Seasonal entry** (whose palette and decorations show), the
**logo entry** (whose logo shows) and the epoch ms at which either can next change. `themeId` is
the saved theme; `preview` is the session preview, else the pinned preview, else `null`.

1. Resolve the hemisphere ([Hemisphere](#hemisphere)) and drop every entry whose filter doesn't
   match it.
2. Among the entries active at `now`, a holiday beats a season. Among holidays the narrowest
   window (fewest days in the window that holds `now`) wins, and registry order breaks a tie.
   Known collisions: Valentine's Day beats Lunar New Year (Feb 12 – 15, 2029), and St Patrick's
   Day beats an early Easter (Mar 16 – 17, 2008).
3. **On Seasonal** some season is always active, so there is always a Seasonal entry: the
   winner. The logo entry is the winner after its alias.
4. **On any other theme** the Seasonal entry is `null`. The logo entry is the winner (after its
   alias) only when the winner is a holiday; otherwise `null`.
5. **An entry preview** makes that entry both outputs (the logo after its alias), whatever its
   hemisphere filter, and the page renders as Seasonal for the session. **`none`** gives `null`
   for both and leaves the theme alone.
6. **`until`** is the next window start or end, in the windows of last year, this year and next
   year, at which either unpreviewed output changes. A preview returns the same `until`.

`app/seasonal/appearance.test.ts` drives every calendar, hemisphere and precedence rule through
this function with table-driven cases; add a holiday's cases there.

`SeasonProvider` mounts inside `ThemeProvider` in both app roots, on every theme, because the
logo needs it everywhere. It reads the saved theme, the previews, the hemisphere setting and the
device zone, runs the resolver, and re-runs it on window focus and hourly, so a launcher left
open across a boundary changes within the hour. It exposes `useSeasonalEntry()`,
`useLogoEntry()` and `useHemisphere()` (`{ resolved, detected, setting }`).

- It sets `data-season='<id>'` on `<html>` only when there is a Seasonal entry, so a holiday on
  another theme sets no attribute and no tint.
- During an entry preview it calls `ThemeProvider`'s `setPreviewThemeId('seasonal')`: the root's
  `data-theme` and `dark` follow the preview, while `useTheme().themeId`, `utbt:theme:v1` and
  the picker keep the saved choice. Picking a theme during a preview saves it and keeps
  Seasonal showing.
- It writes `utbt:season:v2` for the pre-paint script: what Seasonal would show with no preview
  applied, whatever the current theme (`resolveAppearance` with `themeId: 'seasonal'`,
  `preview: null` and no hemisphere preview).
- The stream roots mount `ThemeProvider` but never `SeasonProvider`, so stream routes never get
  `data-season` or a preview's `data-theme`.

#### Hemisphere

`app/seasonal/hemisphere.ts`:

- **Detection.** `deviceTimeZone()` reads the device's IANA zone
  (`Intl.DateTimeFormat().resolvedOptions().timeZone`), never the display time zone override in
  Settings. `detectHemisphere(timeZone)` is `south` for an exact, case-sensitive match in
  `SOUTHERN_ZONES` and `north` for anything else, including a missing zone. Equatorial zones get
  no special case: `Africa/Nairobi` and `Asia/Jakarta` are southern, `Asia/Singapore` and
  `America/Bogota` northern.
- **The table.** `SOUTHERN_ZONES` lists every zone whose reference location in the IANA zone
  table lies south of the equator, plus their legacy aliases (built from tzdata 2026f), sorted,
  one per line. To regenerate from a later tzdata release: a zone in `zone.tab` or
  `zone1970.tab` takes the sign of its own latitude; every other name comes from a `Link` line
  and takes its target's hemisphere, following chains; where `backward` marks a link with
  `#= TARGET`, use that target, and let `backzone` override `backward`. Only a new southern zone
  or a new alias of one changes the list. `hemisphere.test.ts` holds the samples on both sides,
  the aliases and the sort order.
- **The setting.** `utbt:hemisphere:v1`: `"auto"` (default), `"north"` or `"south"`,
  account-synced, written by the Hemisphere control under the Seasonal card
  (`saveHemisphereSetting` in `preferences.ts`).
- **The preview.** `?hemisphere=north|south` on web (captured by `renderer-web.tsx` into
  sessionStorage `utbt:hemisphereOverride:v1`) holds for the session. Other values are ignored.
- **Precedence** (`resolveHemisphere`): the preview, then a setting other than `auto`, then
  detection.

#### Logo on every theme

- `useLogo()` / `logoFor(entry)` (`app/seasonal/logos.ts`) show the logo entry's
  `app/assets/seasonal/logo-<id>.webp`, following the entry's `logo` alias, and `logo.webp`
  with no logo entry. **Holiday logos show on every theme, with no opt-out; season logos only on
  Seasonal.** Summer Christmas shows Christmas's logo through its alias, so the logo never
  depends on the hemisphere.
- They show in the sidebar, the mobile top bar, the desktop splash and the web boot screen. The
  favicon, the window and taskbar icon, the installer icons, the stream scenes and the stinger
  keep `logo.webp`; the titlebar shows no logo.
- The files are `import.meta.glob` URLs, so only the active entry's file downloads. React picks
  the logo on the first render; the pre-paint script plays no part in it.
- Each file is a recolour of `app/public/icon-512.png`, rendered by
  `node scripts/render-seasonal-logos.mjs [--preview <dir>]` from one palette per entry in the
  script's table. No redesigns and no per-theme variants: a logo that reads badly on some theme
  (White in particular) gets its recolour palette adjusted. The script re-renders every file, and
  unchanged palettes come out byte-identical, so commit only the files you meant to change.
- `app/seasonal/logos.test.ts` requires a file for every entry without an alias, and an alias
  only to an entry that has its own file.

#### Palette contract

Each entry has one block in `app/styles/seasons.css`, selected by
`:root[data-theme='seasonal'][data-season='<id>']`; the file holds no other selector, so no
other theme is ever tinted. A block may set only:

- the accent ramp `--accent-50…950` and `--accent-glow-rgb`;
- the nebula `--nebula-1…4`;
- the surfaces `--background`, `--card`, `--popover`, `--secondary`, `--muted`, `--accent`,
  `--border` and `--input`;
- optionally `--window-c-titlebar-background`.

Foregrounds, `--hairline-rgb`, radii, functional and chart colours stay inherited. Surfaces are
tinted darks, lifted at most to mid-dark, never pastel. Write `--background` and `--card` as
opaque `hsl(…)`, `rgb(…)`, `#hex` or `oklch(…)`.

`app/styles/seasons.test.ts` fails on a missing, duplicate or foreign block, on a variable
outside that list and on an unreadable or translucent surface. It resolves each block over the
`globals.css` tokens and the Seasonal base, and holds the **contrast floor**:

- accent-200, 300 and 400 text on the block's background, and white on accent-500: AA (4.5:1),
  or at least Classic's own ratio where Classic is below (Classic's white on accent-500 is
  3.76:1);
- foreground and muted-foreground on the block's background and on its card: AA.

`teamAccent.test.ts` also needs every team accent at 4.5:1 on each block's background and card.
Each look keeps its character: summer a deep ocean blue with a sun tinge, spring cherry blossom,
autumn amber and brown, winter slate and silver; Valentine's apart from Rosé, St Patrick's apart
from Emerald and spring, Lunar New Year apart from Christmas red and Aurum gold, and every look
apart from the Patreon themes.

#### Decorations

Decorations render only when there is a Seasonal entry: the Seasonal theme, or an entry preview.
They are one lazy chunk (`SeasonalDecor.tsx` and `app/seasonal/decor/`), mounted through
`lazyDecor.tsx` (`SeasonalAmbient`, `SeasonalSpinnerGlyph`, `fireSeasonalBurst`) behind Suspense
and a silent boundary, so a failed import renders nothing, and the web `vite:preloadError`
reload ignores this chunk.

- **The Effects switch.** The "Effects" row under the Seasonal card writes
  `utbt:seasonalEffects:v1` (JSON boolean, default `true`, account-synced). Off does what
  reduced motion does: no ambient layer and no burst, while the palette, the logo and the spinner
  glyph stay. The gate lives in `lazyDecor.tsx`, so no entry's branch checks it, and with it off
  the chunk isn't loaded for the layer or a burst.
- **Ambient layer.** `AppLayout` renders `SeasonalAmbient` on every page of the app shell, as a
  sibling before `main` and under it, outside the scroller, with `pointer-events: none`; stream
  routes never render `AppLayout`. The layer is `.seasonal-layer[data-season-layer='<id>']`. It
  pauses on window blur or a hidden page (`data-paused`) and renders nothing under reduced
  motion. Animate only `transform` and `opacity` (`e2e/seasonal.spec.ts` asserts it);
  `offset-path` runs on the main thread, so flight paths come from nested elements each running
  one `transform` animation at periods that don't line up. Keep particles faint enough that
  tables and forms read as on a plain theme.
- **Budgets.** A particle is a direct `span` child of `.seasonal-layer`; a slow effect is a
  `div` and doesn't count. Below 768 px `.seasonal-layer > span:nth-of-type(2n)` hides every
  second particle. Seasons: at most 8 particles or one slow effect. Holidays: at most 16
  (Christmas's snow). Summer Christmas: summer's rays plus at most 8 twinkles. New Year counts
  its sparks: 2 blooms of 8.
- **Burst.** Clicking the sidebar logo (`SidebarBrand`) fires `.seasonal-burst`: 10 particles
  for a season, 12 for a holiday, 14 for Christmas, each entry with its own shapes and drift.
  10 s cooldown; nothing under reduced motion or with Effects off.
- **Spinner glyph.** `<Spinner>` shows the entry's glyph instead of `Loader2`, from lucide (or
  `createLucideIcon`, as for the pumpkin and the lantern). It stays under reduced motion and with
  Effects off.

| Entry | Ambient | Glyph | Burst |
|---|---|---|---|
| Spring | 8 drifting cherry-blossom petals | spinning `Flower` | blossom petals |
| Summer | faint sun rays from the top-right corner, breathing (one slow effect) | spinning `Sun` | gold sun sparks |
| Autumn | 8 falling leaves | wobbling `Leaf` | leaves |
| Winter | icicles along the top edge (under the top bar below `lg`) plus 8 sparse slow flakes | still `Snowflake` | ice crystals |
| New Year | 2 slow firework blooms in the upper third, moving while invisible | wobbling `PartyPopper` | sparkles and confetti |
| Lunar New Year | 6 red-gold lanterns rising and swaying | swinging `Lantern` | lanterns and coins |
| Valentine's Day | 8 hearts floating up and fading | beating `Heart` | hearts and rose petals |
| St Patrick's Day | 8 drifting shamrocks plus 6 gold glints | slowly spinning `Clover` | shamrocks and gold glints |
| Easter | petals and a butterfly | wobbling `Egg` | petals |
| Halloween | fog and bats | wobbling `Pumpkin` | bats |
| Christmas | 16 falling flakes | spinning `Snowflake` | snowflakes |
| Summer Christmas | summer's rays plus 8 gold twinkles, no snow | slowly spinning `Star` | gold stars and red baubles |

#### The Seasonal card

Settings → Appearance (`LauncherAppearanceSettings.tsx`, `SeasonalThemeOptions.tsx`):

- The card sits in the Gradients group. A theme with the registry's `new` flag gets a neutral
  "New" chip (Sparkles icon) on its card.
- `useSeasonalCard()` resolves what Seasonal would show now (with any preview applied), on any
  saved theme. The swatch is that entry's `--accent-500`, read by `seasonalAccent()` in
  `seasonalCard.ts` from `seasons.css` and the base block in `themes.css` through `?raw`
  imports, so the stylesheet is the one source. The subtitle is `seasonalSummary()`:
  "Now: Halloween" for a holiday, "Now: Autumn · Southern hemisphere" for a season.
- While Seasonal is the saved theme, two rows follow the card grid: **Hemisphere**, a
  `role="group"` of Auto (naming what it detected, "Auto (Southern)"), Northern and Southern,
  44 px tall, wrapping below `@md/panel`; and **Effects**, the shared `Switch` padded to a
  44 px target.
- Picking Seasonal also dismisses the [new-theme notice](#new-theme-notice).
- Dev builds add a "Season preview" section (`import.meta.env.DEV`) whose select lists
  Automatic (by date), No season and every entry; it writes the session preview.

#### Storage, pre-paint and the e2e pin

| Key | Where | Holds |
|---|---|---|
| `utbt:theme:v1` | synced | `{ "id": "seasonal" }` like any theme |
| `utbt:hemisphere:v1` | synced | `"auto"` / `"north"` / `"south"` |
| `utbt:seasonalEffects:v1` | synced | `true` / `false` |
| `utbt:seasonOverride:v1` | sessionStorage | the session preview, raw: an entry id or `none` |
| `utbt:hemisphereOverride:v1` | sessionStorage | the hemisphere preview, raw `north` / `south` |
| `utbt:seasonPin:v1` | localStorage, device-local | the pinned preview, raw: an entry id or `none` |
| `utbt:season:v2` | localStorage | the pre-paint cache, `{ "id": EntryId \| null, "until": number }` |
| `utbt:seasonalNotice:v1` | localStorage, device-local | the ISO time the notice was dismissed |

Helpers live in `app/seasonal/preferences.ts`; how synced keys work is in
[state-patterns.md](state-patterns.md). The Seasonal theme reads no other key.

**Pre-paint.** The `app/index.html` script gets the palette right on the first frame, off the
stream paths only:

1. A preview decides first: `?season=`, then `utbt:seasonOverride:v1`, then
   `utbt:seasonPin:v1`; an invalid value falls through to the next. An entry sets
   `data-season`, `data-theme='seasonal'` and `dark`. `none` sets nothing and keeps the stored
   theme.
2. With no preview, only a stored `seasonal` theme gets a season: an unexpired
   `utbt:season:v2` (`until` after now) naming a registered entry decides.
3. Otherwise (a cold, expired or unknown cache) the script takes the season from the month:
   `seasonMonths[(month + (south ? 6 : 0)) % 12]`. The hemisphere is `?hemisphere=`, then
   `utbt:hemisphereOverride:v1`, then a stored `utbt:hemisphere:v1` of `north` or `south`, then
   the device zone against the inline `southernZones`. Holidays appear once the provider has
   resolved them.

The script can't import the registries, so it carries `seasonalTheme`, `entries`,
`seasonMonths` and `southernZones` inline; `app/prePaint.test.ts` fails until they match
`SEASONAL_THEME_ID`, `ENTRY_IDS`, the season windows and `SOUTHERN_ZONES`, and runs the script
against fake storage, location, `Date` and `Intl`. The cache ignores the hemisphere preview, so
in a `?hemisphere=` session with a warm cache the first frame shows the cached look until the
provider mounts.

**The e2e pin.** `utbt:seasonPin:v1` takes the same values as the session preview and ranks
below it; no UI writes it. The Playwright storage state and the mobile fixture refresh preset it
to `none`, so no spec depends on the run date, and since `none` never changes the theme, each
spec's own theme preset holds. A spec that needs the calendar removes the pin in an init script
and pins the clock (`page.clock.setFixedTime`); one that needs a hemisphere sets
`test.use({ timezoneId })` or `?hemisphere=` ([testing.md](testing.md#seasonal-specs)).

#### New-theme notice

A one-time card at the top of Home ("New: Seasonal theme · Follows the seasons and holidays
where you are.") points returning players at the theme. It shows only while the `seasonal`
registry entry carries `new`, Seasonal isn't the saved theme and `utbt:seasonalNotice:v1` is
unset. "Try it", the × and picking Seasonal write the key; while Seasonal is saved the notice
renders nothing and writes it too. **Removing `new` from the entry retires the "New" chip and the
notice together** (the release after launch). The Playwright storage state and the mobile fixture
refresh preset the key as dismissed; only `e2e/seasonal-notice.spec.ts` clears it. Component and
rules: [home.md](features/home.md#new-theme-notice).

## Adding a theme

Copy Slate Blue Squared (#205) for a solid theme, `red` for a gradient one, `aurum` for a
Patreon one. A theme is CSS variables plus one registry entry; Settings, persistence and
the pre-paint script pick it up.

1. **Palette.** A `:root[data-theme='<id>']` block in `app/styles/themes.css` setting what
   [Themes](#themes) lists: the `--accent-50…950` ramp, `--accent-glow-rgb`,
   `--nebula-1…4` for a gradient theme, and the surfaces (`--background`, `--card`,
   `--popover`, `--secondary`, `--muted`, `--accent`, `--border`, `--input`). Anything left
   out comes from Classic (`:root` in `themes.css`, then `globals.css`). Write
   `--background` and `--card` as `hsl(…)`, `rgb(…)`, `#hex` or `oklch(…)`:
   `app/components/pages/events/stats/teamAccent.test.ts` reads them from every
   theme block and fails when a team accent drops under 4.5:1 on them. It also fails on a
   value it can't read (`var(…)`, `color-mix(…)`, `lab(…)`), on a translucent one, and on a
   registered theme with no block of that exact selector, so no theme goes unchecked.
   Optional: `--window-c-titlebar-background` (desktop titlebar), `--radius-*` (Slate Blue
   Squared sets all to 0).
2. **Solid only:** add the theme's `.nebula-bg` selector to the `display: none` rule at the
   end of `themes.css`. `app/styles/themes.test.ts` fails until every registered theme has
   a palette block and that rule lists exactly the `solid` group.
3. **Registry.** Append a `ThemeMeta` to `THEMES` (`app/theme/themes.ts`): `id` (the
   selector's value), `label`, `description`, `swatch` (the picker dot), `group`, and
   `exclusive: true` for a Patreon theme ([Registry flags](#registry-flags)). `isThemeId`
   reads the list, so a stored id missing from it falls back to Classic.
4. **No edit for Settings or storage.** `LauncherAppearanceSettings` renders `THEMES` by
   `group` and locks `exclusive` ones; the choice syncs with the account under
   `utbt:theme:v1`. Season and holiday palettes tint only the Seasonal theme, so the new
   theme never shows one; during a holiday it shows only the holiday logo.
5. **No pre-paint edit for a dark theme.** The `app/index.html` script sets `data-theme`
   from `utbt:theme:v1` before React mounts, so the first frame is already themed. **A
   light theme** also gets `light: true` in the registry and its id in the script's
   `lightThemes` list (the script can't import the registry; `app/prePaint.test.ts` fails
   until the two match). `ThemeProvider`, `PlayerInfo`, `titleStyles.ts` and the `select` /
   `option` rules follow the flag. Its palette sets what the `light` block sets
   ([Light](#light)): `--hairline-rgb`, the foregrounds, an accent ramp with dark 200–400
   shades, the functional text shades and `--chart-*`, plus light team-accent blocks
   ([events.md](features/events.md)).
6. **Verify.** `npm test` passes, `teamAccent.test.ts` now covering the new block. In
   `npm run dev:web`, pick the theme in Settings → Appearance and reload: no Classic flash;
   accent text, a table, a modal, a `<select>` and an event's Stats tab stay legible. Light
   still looks as before. A Playwright spec can preset the theme the way
   `e2e/pickban-watch.spec.ts` does (`addInitScript` writing `utbt:theme:v1`).

## Adding a season or holiday

A season or holiday is one registry entry plus its palette block, its logo (or an alias), its
decoration branches, its pre-paint id, its window cases and its e2e cases. Copy the latest
holiday, Valentine's Day or St Patrick's Day. The dev preview options, the logo lookup, the
stylesheet and logo checks and the e2e preview loop derive from `ENTRIES`, so they need no
edit. Rules for each part: [Seasonal theme](#seasonal-theme).

1. **Register.** Insert `{ id, label, kind, window }` into `ENTRIES`
   (`app/seasonal/seasons.ts`), plus `hemisphere` for a one-hemisphere entry and `logo` to
   reuse another entry's logo (as `christmas-summer` does). Registry order breaks ties between
   holidays of the same width, so place it deliberately. A window comes from a rule or a table,
   never a network lookup; a date table goes in its own module beside the registry, with a test
   that pins its range (copy `lunarNewYear.ts`).
2. **Window cases.** In `app/seasonal/seasons.test.ts`, the entry's fields and its window. In
   `app/seasonal/appearance.test.ts`, its edges on and off at local midnight in both
   hemispheres, the season and any holiday it collides with, the logo only on Red, Classic and
   Light, a preview, and `until`. Expect to update existing cases whose dates fall inside the
   new window.
3. **Pre-paint.** Add the id to the inline `entries` list in `app/index.html`, at the same
   position as in the registry; `app/prePaint.test.ts` fails until the two match.
   `seasonMonths` and `southernZones` change only when the seasons or the zone table do.
4. **Palette.** A `:root[data-theme='seasonal'][data-season='<id>']` block in
   `app/styles/seasons.css` that sets only what the [palette contract](#palette-contract)
   allows. `app/styles/seasons.test.ts` and `teamAccent.test.ts` fail until it exists and passes
   the contrast floor. The Seasonal card's swatch reads it, with no edit.
5. **Logo.** An entry in the logo palette table of `scripts/render-seasonal-logos.mjs`,
   rendered to `app/assets/seasonal/logo-<id>.webp` (`app/seasonal/logos.test.ts` checks the
   file), or a `logo` alias in step 1. Commit only the new file, and check it on every theme,
   White included.
6. **Decorations**, all in `app/seasonal/decor/`: its glyph in `glyphs.tsx` (and
   `glyphs.css` for a new motion), its burst shapes, drift and count in `burst.ts` and
   `burst.css`, and its ambient branch in `ambient.tsx` with one block at the end of
   `ambient.css`, inside the [budgets](#decorations). Shared shapes and colours go in
   `shapes.ts`. Give new keyframes names no other entry uses. The Effects switch and reduced
   motion already gate every branch.
7. **e2e.** In `e2e/seasonal.spec.ts` the preview loop covers the entry through `ENTRY_IDS`
   (tint, logo, `dark`, a non-empty layer, compositor-only animations). Add a `describe` for
   the entry: the calendar with the pin cleared and the clock pinned, on Seasonal and on Red;
   the particle budget at 1280 and 390 px; the glyph; and the burst's shapes and cooldown.
8. **Verify.** `npm test`, `npx playwright test e2e/seasonal.spec.ts e2e/seasonal-card.spec.ts`
   and `npm run check:bundle` pass, and in `npm run dev:web`, `/?season=<id>` shows the tint,
   logo and decorations on Home, a table page and with a modal open.

## Surfaces and radii

| Layer | Background | Border |
|---|---|---|
| Page | `bg-background` (root) | — |
| Card, filter panel, table scroll container | `bg-card/30` | `border border-hairline/5` (`/10` for stronger) |
| Card hover | `bg-card/80` | `border-hairline/20` |
| Inline chip / badge | `bg-hairline/5` | `border border-hairline/5` |
| Sticky thead | `bg-card/95 backdrop-blur` | — |
| Modal (`ui/modal.tsx`) | `bg-card` | `border border-border`, header and footer `bg-muted/50` |

Radii: `rounded-xl` big containers, `rounded-lg` buttons and inputs, `rounded-md` chips
and small actions, `rounded` badges.

## Text

| Use | Class |
|---|---|
| Page title | `text-2xl font-bold text-foreground leading-tight` |
| Section label (small caps) | `text-[10px] uppercase tracking-wider text-muted-foreground` |
| Table header | `text-xs uppercase tracking-wider font-medium text-muted-foreground` |
| Body | `text-sm` |
| Subtitle / hint | `text-xs text-muted-foreground` |
| Numbers (times, ping, ranks) | `font-mono tabular-nums` |
| Player / map name | `text-sm font-semibold text-foreground` |

Body text stays on the system font. `font-pickban` (Barlow Condensed) is the pick/ban
and broadcast display face. Its `@font-face` rules are in
`app/components/broadcast/broadcastFonts.css`, loaded only by the lazy pick/ban and
stream code (`useBroadcastFonts` in `broadcastFonts.ts`, or a direct CSS import as in
`PickBanStage`), so the entry CSS doesn't carry them. The font files are imported
assets under `app/assets/fonts/barlow-condensed/` rather than `app/public/` files,
because the desktop build has no public dir and loads over `file://`. Four faces
ship: 600 and 700 upright, 800 and 900 italic.

## Page layout

```tsx
<div className="space-y-4 flex flex-col overflow-hidden">
  <header />          {/* title block, shrink-0 */}
  <toolbar />         {/* search / Filters / Columns, shrink-0 */}
  <filterPanel />     {/* collapsible, shrink-0 */}
  <error />           {/* conditional banner */}
  <promoStrip />      {/* web, Server Browser only: DesktopAppNotice, shrink-0 */}
  <DataTableShell />  {/* the table's own sideways scroller */}
  <PaginationBar />   {/* optional, shrink-0 */}
  <modals />
</div>
```

A page grows with its content; the shell's main element is the only vertical scroller. Don't
give a page or a section `h-full` / `flex-1 min-h-0` with `overflow-y-auto` to make it scroll
on its own ([navigation.md](navigation.md#scroll-position-and-the-shell-scroller)).

Title block:

```tsx
<div className="flex items-end justify-between shrink-0">
  <div>
    <h1 className="text-2xl font-bold text-foreground leading-tight">{title}</h1>
    <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
  </div>
  <div className="flex items-center gap-1">{/* tutorial + refresh icon buttons */}</div>
</div>
```

Header icon button:
`p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-hairline/5 transition-colors cursor-pointer`.

Filter panel:

```tsx
<div className="bg-card/30 border border-hairline/10 rounded-xl p-4 space-y-4 shrink-0">
  <FilterPanelRow label="…"><MultiFilterDropdown … /></FilterPanelRow>
  <div className="flex items-center justify-between gap-3 pt-2 border-t border-hairline/5">
    <FilterPresetsMenu … onResetFilters={resetFilters} />
  </div>
</div>
```

### Hero and stat-tile rows wrap

Detail-page title rows pair a `line-clamp-2 break-all` title (map names have no
spaces) with a `flex-wrap` actions group; a `truncate` title beside a `shrink-0` button
row squeezes the title to nothing around 1024px. Stat tiles use responsive grid steps
(`grid-cols-2 sm:grid-cols-3 xl:grid-cols-5`), labels and subtext wrap
(`leading-tight`, no `truncate` on key data), and `w-px` flex dividers get
`max-sm:hidden` so a wrapped row doesn't strand a bar. `MetaPill` wraps internally;
leave `whitespace-nowrap` off it.

### Sidebar width

The sidebar's width is one property, `--sidebar-width`, which `AppLayout` sets on
`document.documentElement` in a layout effect before first paint: `16rem` expanded,
`5rem` collapsed, `0px` below `lg` (where the sidebar is a drawer, 18rem plus the left
safe-area inset, set by `.shell-drawer` in `app/styles/shell.css`). It
is removed on unmount, so an overlay rendered before the layout falls back to `0px`.

Anything beside the rail reads `var(--sidebar-width,0px)`, always with the fallback,
instead of `16rem`, `lg:pl-64` or `256px`:

- a modal passes `offsetSidebar`, which pads the backdrop
  `pl-[calc(var(--sidebar-width,0px)_+_1rem)]`, centring the dialog on the content
  area in both rail modes (on phones the modal is a full-screen sheet instead,
  [shared-components.md](shared-components.md#modal));
- a full-height overlay starts at `left-[var(--sidebar-width,0px)]` (`ErrorModal`'s
  non-fullscreen backdrop, the Game Input key-capture overlay and bind-conflict
  dialog);
- a centred banner uses `left-[calc(50%_+_var(--sidebar-width,0px)/2)]` and
  `w-[calc(100vw_-_24px_-_var(--sidebar-width,0px))]` (`AnalyticsConsentBanner`).

### Tooltip sides

`Tooltip` (`app/components/ui/tooltip.tsx`) takes `side="top"` (default), `"bottom"` or
`"right"`. Top and bottom flip when there is no room. `right` sits 10px right of the
trigger, vertically centred, clamped 8px inside the titlebar's bottom and the viewport
bottom, with the arrow on the trigger's middle. Use `right` for everything in the
collapsed rail, so tooltips open over the page instead of the rail. On touch devices a tap opens
the tooltip instead of hover ([shared-components.md](shared-components.md)).

## Tables

Table styling is locked inside `app/components/shared/DataTable.tsx`; render tables
with the `DataTable.*` primitives (see [shared-components.md](shared-components.md))
and extend them rather than styling cells inline.

| Element | Class |
|---|---|
| Scroll container | `flex-1 min-h-0 bg-card/30 border border-hairline/5 rounded-xl overflow-auto` |
| `<table>` | `w-full table-fixed text-sm` |
| `<thead>` | `sticky top-0 z-[2] bg-card/95 backdrop-blur` |
| `<thead> <tr>` | `border-b border-hairline/10` |
| `<th>` | `px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider` + align |
| `<th>` sort button | `inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer` |
| `<tbody> <tr>` | `border-b border-hairline/5 hover:bg-hairline/[0.03] transition-colors group` |
| `<td>` | `px-4 py-3` (`px-3 py-2` in condensed density) |
| Empty state `<td>` | `px-4 py-16 text-center text-muted-foreground`, text only, no icon |

Sort icons: `ArrowUpDown` (`size-3 opacity-30`) unsorted; `ChevronUp` / `ChevronDown`
(`size-3 text-accent-400`) active.

### Column widths and alignment

`table-fixed` takes column widths from the header row. Give every
`DataTableHeaderCell` an explicit `width` except the one primary text column (Player,
Name, Map, Rusher), which stays width-less and absorbs the slack. Without widths,
`table-fixed` splits columns evenly and a right-aligned number floats to the far edge.

| Content | `align` |
|---|---|
| Numbers: rank, points, ping, times, %, counts | `right`, plus `font-mono tabular-nums` |
| Text: name, author, role, dates | `left` (default) |
| Icon, status badge, actions, difficulty, medal icon + count | `center` |

Body cells inherit width from the header and need only the matching `align`. A table
built entirely of centred composite cells (Maps WR / PB: time over a sub-label) stays
all-centred for internal consistency.

### Responsive columns

Every tabular surface passes `responsive` to `DataTableShell` so it fits any width
from a 360px phone up, never by horizontal scroll:

```tsx
responsive={{ columns, onResolve, compactAriaLabel, onCompactChange, cards, nameFloorRem?, extraRem? }}
```

- `columns: ResponsiveColumn[]` (`{ id, tier, label, width?, priority?, required?,
  hiddenByUser?, sortKey?, cell? }`) lists every column in display order. `tier` and
  `label` are required, so a column without them doesn't compile. A column the user hid
  through `ColumnsMenu` stays in the list with `hiddenByUser: true`: the table skips it
  and the cards still list it. Each `width` is the same literal as its header cell; `rem`
  and `px` are measured, `%` or no width counts as the flex column at `nameFloorRem`
  (default 12).
- The shell measures itself (`useElementWidth`) and then, in order: condenses
  padding below 58rem; hides optional columns that don't fit, lowest `priority` first
  (default 50; `required` columns always stay); sizes the table's `minWidth` from the
  surviving columns; and, when even the required columns don't fit, renders the cards
  instead of the table.
- Mark the flex (name) column and the page's core metric (time, count, points)
  `required`, so mid widths never drop them before cards engage; a leaderboard
  showing only rank and name is a bug. Mark any tutorial-spotlighted column
  `required` so auto-hide can't null its ref. Keep priorities beside the column
  records as `COLUMN_PRIORITY: Partial<Record<TColumnId, number>>`.
- `onResolve(visibleIds)` returns the surviving ids. Render
  `userVisible && resolved.has(id)` on both the header and the body (a one-sided gate
  desyncs `table-fixed` tracks). The result is render-time only: keep it out of
  persisted state and `columnVisibility`, or it overwrites the user's column prefs.
  Wrap `onResolve` in `useCallback`. The columns carry `cell` renderers that read the
  page's render state, so most pages build them on each render.
- `onCompactChange(compact)` reports the switch to cards. Hide `ColumnsMenu` and any
  sort-header control while `compact` is true.
- On a touch device the table renders only when every non-decorative column fits, and
  DataTable draws the cards, their expand panel and the card sort control
  ([shared-components.md](shared-components.md#column-tiers-and-phone-cards)).
- The only exception is `tableOnly: true` instead of `cards`: the cap page's checkpoint
  split, sector and speed tables stay tables on every device and drop columns by
  priority, with widths tuned to fit 360 px ([records.md](features/records.md)).
- Header `width` literals and `ResponsiveColumn.width` values must match. A header
  forcing a width on the flex column makes the real table wider than the computed
  `minWidth` and brings back horizontal scroll.

The card face shows the essential fields, renders identity through `PlayerInfo` and
times through `CapTimeLink`. Skeleton and empty states go in `cards.placeholder`, since
the cards replace the whole table including `DataTableSkeletonRow` and `DataTableEmpty`.

References: the five event tables
([events.md](features/events.md#phone-cards), standings with `cards.panel`), `WorldRecordsPage.tsx`,
`PlayersPage.tsx` and `ServerBrowserPage.tsx` (with ColumnsMenu, `hiddenByUser`, `onCompactChange`
and the card sort), `CapItAllPage.tsx`, `mapDetail/LeaderboardCard.tsx` (a panel with actions),
`home/LatestRecordsCard.tsx` (every column essential, no panel), `teams/TeamActivityPanel.tsx`
(card sort over a client-sorted feed), the seven profile tabs in `playerDetail/`
(`RecentCapsCard.tsx` with a panel of actions, `WorldRecordsCard.tsx` with no panel), the admin
tables through `useAdminTable` and `AdminCardFace` (`admin/sections/AuditLogsSection.tsx`: extra
panel content and a `DataTableExpandRow` on the table; [admin.md](features/admin.md#tables-on-phones)).

## Buttons and chips

### Toolbar toggle (Filters and similar)

```ts
// shape
'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer'
// inactive
'bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20'
// active (panel open)
'bg-accent-500/20 border-accent-500/50 text-accent-300'
```

Count badge inside it:
`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent-500 text-white`.
`Segmented` uses the same inactive and active colours at `px-3 py-1.5 text-xs`.

### Tinted button family

Shape: `h-8 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer flex items-center gap-2`.

| Intent | Rest | Hover |
|---|---|---|
| Accent (primary, active toggle) | `bg-accent-500/15 border-accent-500/40 text-accent-200` | `bg-accent-500/25 border-accent-500/60` |
| Emerald (positive, save) | `bg-emerald-500/10 border-emerald-500/30 text-emerald-300` | `bg-emerald-500/25 text-emerald-200 border-emerald-500/50` |
| Red (destructive, clear) | `bg-red-500/10 border-red-500/30 text-red-300` | `bg-red-500/25 text-red-200 border-red-500/50` |
| Rose (warning, demos) | `bg-rose-500/10 border-rose-500/30 text-rose-300` | `bg-rose-500/25 text-rose-100 border-rose-500/50` |
| Amber (warning, overtime) | `bg-amber-500/10 border-amber-500/30 text-amber-300` | — |

### Row actions (Join, Spec)

```ts
// primary
'inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border border-accent-500/30 bg-accent-500/10 text-accent-300 hover:bg-accent-500/25 hover:text-accent-100 hover:border-accent-500/50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
// secondary
'inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border border-hairline/10 bg-hairline/5 text-muted-foreground hover:bg-hairline/10 hover:text-foreground hover:border-hairline/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
```

Icon-only action cells use `IconActionButton`.

### Active filter chips

Show what is filtered with one `ActiveFilterChip` per filter value
(`[LABEL value ×]`, accent-tinted, styling locked in the component), in a row between
the toolbar and the filter panel, rendered only while filters are active.

### Status chips

`app/components/shared/chipStyles.ts` holds the shared chip: `CHIP_SHAPE` (the shape
`EventStatusBadge` and the bracket `Chip` use) and `LIVE_CHIP_STYLE` (live red).
Compose them with `cn` instead of retyping the classes.

## Form inputs

Text input:
`px-3 py-2 bg-card/50 border border-hairline/10 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent-500/50`.
Search variant: `pl-9 pr-9`, a `<Search>` icon at
`absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none`,
and while there is a value a clear button at `absolute right-2` with `<X className="size-3.5" />`.

Checkbox: `accent-[var(--accent-500)] cursor-pointer` (favourites:
`accent-yellow-400`), wrapped in

```tsx
<label className="flex items-center gap-2 px-3 py-2 bg-card/50 border border-hairline/10 rounded-md text-sm text-foreground cursor-pointer hover:border-hairline/20 self-end">
  <input type="checkbox" … />
  <span>Label</span>
  {count > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent-500/20 text-accent-300 border border-accent-500/30">{count}</span>}
</label>
```

Native `<select>`: always `style={{ colorScheme: 'dark' }}`, so Chromium draws dark form
chrome on Windows (Light overrides it in `themes.css`).

**16px on touch.** iOS zooms the page when a focused control's text is below 16px. One
unlayered rule in `app/styles/shell.css` sets every text input, `select`, `textarea` and
contenteditable to `max(16px, 1em)` under `(hover: none)`, at any width. Being unlayered,
it beats every Tailwind font-size utility, so the `text-xs` / `text-sm` classes above stay
as the desktop sizes and nothing per control is needed. Keep it that way: no `!text-*`
or inline `fontSize` on a control, which would beat the rule. The mobile suite's
`form-controls-16px` rule checks it.

## Sidebar

Visual tokens for the sidebar parts. What each part does, the nav registry, badges'
data and the collapse behaviour are in [navigation.md](navigation.md).

### Quick actions (`SidebarActions`, desktop only)

```ts
// primary CTA (Join Server)
'bg-accent-500/15 border border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:text-foreground hover:border-accent-500/60 hover:shadow-[0_0_20px_rgba(59,130,246,0.25)] transition font-semibold rounded-lg'
// secondary (Launch Game)
'bg-card/50 border border-hairline/10 text-muted-foreground hover:text-foreground hover:bg-card/80 hover:border-hairline/20 transition-colors rounded-lg font-medium'
```

Expanded they add `w-full h-11` / `w-full h-9`; collapsed they swap that for the tile
shape below.

### Status tag

A live event link shows the live chip alone in the row's right-aligned trailing slot:
`cn('relative z-10 ml-auto shrink-0', CHIP_SHAPE, LIVE_CHIP_STYLE)`. It stays out of
the label text, adds no row background, left bar or accent colour (those mean
"active"), and never animates, so it doesn't compete with the live dot.

### Icon marks (expanded)

Marks sit on the item's icon, never in the row, so they can't squeeze the label or
the tag; the icon-to-label gap is `gap-4` to leave room.

- **Count bubble**, top-right, shows at most `99+` and grows leftwards over the icon:
  `absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-accent-500 text-white text-[10px] font-black leading-none tabular-nums ring-2 ring-card shadow-[0_0_8px_rgb(var(--accent-glow-rgb)/0.5)]`
- **Lobby dot**, bottom-right: `<LiveDot className="absolute -bottom-1 -right-1 ring-2 ring-card" />`.
  `LiveDot` is the only pinging mark in the rail, the "happening now" signal; the
  event page's lobby row and the Schedule tab's Join banner render the same component.

Marks are `aria-hidden`; their meaning goes in a `sr-only` span after the label and in
the icon's `Tooltip`, one line per detail.

### Collapsed rail

At `lg` and up the sidebar can collapse to a 5rem rail. Switching modes is instant:
nothing in the sidebar uses `transition-all` or animates width, padding, gap or size.
Use `transition` or `transition-colors`, so only colour, shadow and the logo's hover
scale animate.

- **Rail tile** (`SidebarNavItem`): icon over caption, at least 44px tall, full nav
  width, keeping the expanded row's active overlay and hover:
  `flex-col items-center justify-center gap-1 min-h-11 px-1 py-1.5 [@media(max-height:800px)]:py-1`.
- **Caption** (`navItemCaption(item)`), one line, centred, nothing before it:
  `max-w-full truncate text-[10px] leading-tight font-medium`. A caption has about
  59px at 10px; give a longer label a `shortLabel` ("Achievements" captions as
  "Awards"). The rail e2e fails on any overflowing caption.
- **Icon marks**: one corner per signal, each `aria-hidden` with `ring-2 ring-card`.
  - Live, top-left, the collapsed status tag: a static red dot,
    `absolute -top-px -left-2.5 size-2.5 rounded-full bg-red-500 ring-2 ring-card`,
    moved to `-left-4.5` when the count shows `99+`. Red, top-left and static, so it
    reads apart from the pinging emerald lobby dot. Its tooltip line is `text-red-300`.
  - Count bubble, top-right: the expanded bubble at `absolute -top-px -right-[5px]`.
  - Lobby dot, bottom-right: `<LiveDot className="ring-2 ring-card" />` in an
    `absolute -bottom-px -right-5 flex` wrapper, beside the bubble, because the tile
    has no height to stack them.

  The tile leaves 6px above the icon (4px under `max-height: 800px`) and 4px below it,
  so no mark sits more than 1px past the icon and every ring stays inside the tile's
  `overflow-hidden`. `e2e/sidebar-collapse-marks.spec.ts` checks at 1280×900 and
  1024×720 that every mark stays in its tile, on its corner, clear of other marks and
  the caption. Collapsed, marks drop their own tooltip and their lines join the
  tile's right-side tooltip.
- **Section dividers**: titles become `sr-only`; every section, the first included,
  starts with `<div aria-hidden className="mx-3 mb-2 border-t border-hairline/10" />`.
- **Nav**: `overflow-x-hidden [scrollbar-width:none] px-1.5 space-y-2`, since a Windows
  scrollbar would take about 11px of the rail; it still scrolls by wheel, touch and
  focus. Expanded keeps its scrollbar.
- **Action tiles**: 48px squares (44px under `max-height: 800px`), a `size-5` icon
  over a `text-[10px]` caption, same colouring and disabled look:
  `size-12 [@media(max-height:800px)]:size-11 flex-col gap-0.5 px-0 has-[>svg]:px-0`.
- **Logo** (`SidebarBrand`): `size-10` in `px-4 pb-4 pt-14` (`px-2 pb-2 pt-12` on short
  windows), leaving room for the toggle.
- **Toggle** (`SidebarCollapseToggle`): `size-9` ghost button, `size-5` icon,
  `rounded-lg text-muted-foreground hover:text-foreground hover:bg-hairline/10 transition-colors`,
  placed by `SidebarBrand` at `absolute left-[22px] top-3` (`top-2` short), the same
  spot in both modes.
- **User card**: sizes to content. The rarity border and glow move to a ring round the
  avatar: from rarity 3 a 2px ring in the title colour, at rarity 5 also a 15px glow
  with `animate-pulse-slow`. Signed out, the Discord button is a `size-10` square. The
  login-error popover is `bg-popover/95` with a red border and no backdrop blur.

### Desktop promotion (web only)

The sidebar button is the one coloured surface; everything else uses theme tokens. Nothing
animates. What shows when is in [web-target.md](web-target.md#desktop-promotion).

- **Sidebar button** (`DesktopPromoNavRow`): a fixed gold CTA in every theme, shaped like
  the Discord login button below it: `rounded-lg bg-promo-gold text-amber-950
  hover:brightness-110 shadow-lg`, `w-full py-2.5 pl-3 pr-8`, label
  `text-sm font-semibold`, so it fits beside the × at 16rem. Collapsed it is an icon-only
  `size-11` square.
- **Its ×** shows through opacity, not `visibility`, so it stays in the tab order:
  `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 touch:opacity-100`,
  no transition. Expanded it is a full-height `w-8` strip on the button's right edge in
  `text-amber-950` with a `hover:bg-hairline/10` tint; collapsed, a `size-6` round `bg-card`
  badge at `-top-1.5 right-0`, over the square's top-right corner. Every class but
  `bg-promo-gold`, `text-amber-950` and the variants already exists elsewhere: the initial
  CSS budget has almost no headroom.
- **Modal CTA** ("Download for Windows"): the Accent tinted colours at
  `h-10 px-4 text-sm` (larger than the `h-8` family shape, so it stays tappable at
  390 px), full width below `sm`.
- **Inline notice** (`DesktopAppNotice`): `rounded-lg border border-hairline/10 bg-card/30`,
  muted `text-sm` text and icon, the link `text-accent-300` (underline on hover). Hosts
  restyle through `className`: the download result lines pass `text-xs`. Tap targets reach
  40 px without a taller line: the link is `inline-block -mx-2 -my-2.5 px-2 py-2.5` and the
  × is `size-10`.

## Motion

- `animate-in`, `fade-in`, `slide-in-*` and `zoom-in-*` emit no CSS: `tw-animate-css` is
  a dependency but never imported, so those classes do nothing. Older overlays still carry
  them; drop them when you touch one. Animate with framer-motion. `ui/modal.tsx` opens
  without animation because it ships in the web entry; the tutorial dropped its no-op
  classes too.
- Skeletons: `animate-pulse` with `bg-hairline/5`. Legendary titles and avatars:
  `legendaryAvatarPulse` / `legendaryTitlePulse` in `globals.css`.
- framer-motion stays out of the web entry: import it only from lazily loaded
  modules. The curves and presets are in `app/components/broadcast/broadcastMotion.ts`,
  and the pick/ban choreography built on them in
  `app/components/pages/events/pickban/components/stageMotion.ts`; use them as the
  reference. Variants follow view-model state, so a change reverses when the state does
  (an undo). `AnimatePresence` handles enter and exit; a shared `layoutId` makes an
  indicator glide. Animate `transform` and `opacity` (a one-shot `filter` is fine). A
  plain colour or filter change on a card can be a CSS `transition-[…]`, since it
  reverses by itself.
- One-shot effects (bursts, rings, sparks, flashes, as in
  `pickban/components/RevealEffects.tsx`) are variant children whose keyframes start
  invisible and end invisible or on a settled glow, so a scene mounted settled
  (`initial={false}`) or under reduced motion lands on a clean last frame. Keep them
  bounded: a fixed handful of absolutely positioned elements animated once, and at most
  one stage-level element looping while its scene is up.

### Reduced motion

`shared.css` cuts every CSS animation and transition to nothing under
`prefers-reduced-motion: reduce`, except inside `[data-motion='on']`. JS-driven motion
reads the same preference through `usePrefersReducedMotion()`
(`app/hooks/usePrefersReducedMotion.ts`): wrap a framer-motion tree in a
`MotionConfig` whose `skipAnimations` follows it, so every animation is instant and
shows the same information, and make an animation-frame loop step coarsely instead of
gliding (as `CountdownBar` does).

The pick/ban visual core is the exception, because its reveals are the broadcast and
Windows reports `reduce` whenever its animation effects are off: `PickBanMotion` takes
an explicit `animate` flag, sets `reducedMotion="never"`, and marks its wrapper
`data-motion="on"` while animating (details in
[pick-ban-ui.md](features/pick-ban-ui.md)).

## Touch variant

`touch:` (`@custom-variant` in `app/styles/shell.css`) is `@media (hover: none)`, the SPEC's
"any touch device" tier, at any width. Use it for touch-only styling in markup
(`touch:backdrop-filter-none`, which compiles far smaller than `touch:backdrop-blur-none`);
code reads the same fact from the device environment
([web-target.md](web-target.md)).

## CSS runtime cost

The renderer runs on phones and in Electron beside the game, so styles have a
compositor cost:

- `backdrop-blur` is the most expensive effect. The budget is the existing chrome:
  sidebar, top bar, sticky theads, modals, tooltips and popover menus, and the
  pick/ban stage's paused overlay (present only while paused). Blur one surface, never each row or card of a
  list. On touch the top bar (`touch:bg-card`), the drawer (`bg-card`), the drawer
  backdrop and the modal backdrop (`bg-black/80`) swap the blur for a solid tint, and
  the modal panel and the tutorial dim drop their blur.
- Infinite animations (`animate-pulse`, `animate-ping`, the legendary pulses) keep the
  compositor awake. Use them on singletons (a badge, one hero), never per row.
  Skeleton `animate-pulse` is fine because it exists only while loading.
- Transition `transform` / `opacity` rather than layout properties
  (`width`, `height`, `top`); the drawer slides with `translate-x` for this reason.
- Large `box-shadow` glows on hover are fine; permanent glows on hundreds of elements
  are not.
- A page stays smooth with its largest realistic dataset at the largest page size (200
  rows); a per-row effect that can't survive that doesn't ship.
