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
  `app/styles/shared.css`).
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
  it inherits Classic's blue swirl.
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

### Seasonal themes

Halloween, Christmas and Easter decorate the launcher each year; the code is in
`app/seasonal/`.

- **Windows** (`seasons.ts`, viewer's local date, inclusive): Halloween Oct 24 – Nov
  7, Christmas Dec 18 – Jan 15, Easter Sunday ± 7 days (Western, computed). Adding a
  season: [Adding a theme](#adding-a-theme).
- **Precedence**: a preview beats the toggle, the toggle beats the date. The preview
  is `?season=<id>` or `?season=none` on web or a dev-only select in
  Settings → Appearance on desktop, for the session; the toggle is "Seasonal themes"
  in Settings → Appearance (`utbt:seasonalThemes:v1`). `SeasonProvider` (inside
  `ThemeProvider` in both app roots) sets `data-season` on `<html>` and re-checks on
  window focus and hourly. The `app/index.html` pre-paint script sets it from the
  cached season so the accent never swaps after load; it skips the stream paths, and
  the stream roots never mount the provider.
- **Tint** (`app/styles/seasons.css`): selectors are
  `:root[data-season='…']:not([data-theme])`, so only Classic is tinted, and only
  `--accent-*`, `--accent-glow-rgb` and `--nebula-*` change. `seasons.test.ts`
  enforces both and checks contrast: accent-200/300/400 text on the background and
  white on accent-500 reach AA, or at least Classic's own ratio where Classic is below.
- **Logo**: `app/assets/seasonal/logo-<season>.webp`, rendered from
  `app/public/icon-512.png` by `node scripts/render-seasonal-logos.mjs [--preview <dir>]`;
  replacing or adding a file under that name needs no code change: `useLogo()` /
  `logoFor()` (`app/seasonal/logos.ts`) glob `logo-*.webp` and pick it for the sidebar,
  the mobile top bar, the desktop splash and the web boot screen. The favicon, titlebar,
  installer icons, stream scenes and stinger keep `logo.webp`. Only the active season's
  file downloads.
- **Decorations** are one lazy chunk (`SeasonalDecor.tsx`), requested only while a
  season shows. Mount them through `lazyDecor.tsx` (`SeasonalAmbient`,
  `SeasonalSpinnerGlyph`, `fireSeasonalBurst`): Suspense plus a silent boundary, so a
  failed import renders nothing, and the web `vite:preloadError` reload ignores this
  chunk.
  - Burst: clicking the sidebar logo, 10 s cooldown, off under reduced motion.
  - Ambient layer: Home only, behind content, `pointer-events: none`, at most 16
    particles (half hidden below 768px), paused on window blur or a hidden page, not
    rendered under reduced motion. Flight paths come from nested elements each running
    one `transform` animation at periods that don't line up. Animate only `transform`
    and `opacity` (`e2e/seasonal.spec.ts` asserts it); `offset-path` runs on the main
    thread.
  - Spinner: `<Spinner>` shows the season glyph instead of `Loader2`.
- **e2e**: the desktop and mobile Playwright projects preset the toggle to off
  (`storageState` in `playwright.config.ts`) so shell specs don't depend on the run
  date; `seasonal.spec.ts` forces each season with `?season=`.

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
   `utbt:theme:v1`. Seasons tint Classic only, so the new theme never shows one.
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

**A season** (copy Easter, #296) is one registry entry plus its tint, logo and decorations.
`SeasonId`, `SEASON_IDS`, the Settings preview options and toggle text, the logo lookup,
the CSS and e2e checks all derive from `SEASONS` (`app/seasonal/seasons.ts`).

1. **Register.** Append `{ id, label, window }` to `SEASONS`, with a window case in
   `app/seasonal/seasons.test.ts`.
2. **Pre-paint.** Add the id to the `seasons` list in the `app/index.html` script;
   `app/prePaint.test.ts` fails until it matches the registry.
3. **Tint.** A `:root[data-season='<id>']:not([data-theme])` block in
   `app/styles/seasons.css`; `app/styles/seasons.test.ts` fails until it exists and checks
   its contrast.
4. **Logo.** A palette in `scripts/render-seasonal-logos.mjs`, rendered to
   `app/assets/seasonal/logo-<id>.webp` (`app/seasonal/logos.test.ts` checks the file).
5. **Decorations.** Its branches in `app/seasonal/decor/` (`ambient.tsx`, `ambient.css`,
   `burst.ts`, `glyphs.tsx`).
6. **Verify.** `npm test` and `npx playwright test e2e/seasonal.spec.ts` pass (the spec
   loops over the registry), and `/?season=<id>` shows the tint, logo and decorations.

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
<div className="space-y-4 h-full flex flex-col overflow-hidden">
  <header />          {/* title block, shrink-0 */}
  <toolbar />         {/* search / Filters / Columns, shrink-0 */}
  <filterPanel />     {/* collapsible, shrink-0 */}
  <error />           {/* conditional banner */}
  <DataTableShell />  {/* flex-1 min-h-0 */}
  <PaginationBar />   {/* optional, shrink-0 */}
  <modals />
</div>
```

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
`5rem` collapsed, `0px` below `lg` (where the sidebar is a drawer, `max-lg:w-72`). It
is removed on unmount, so an overlay rendered before the layout falls back to `0px`.

Anything beside the rail reads `var(--sidebar-width,0px)`, always with the fallback,
instead of `16rem`, `lg:pl-64` or `256px`:

- a modal passes `offsetSidebar`, which pads the backdrop
  `pl-[calc(var(--sidebar-width,0px)_+_1rem)]`, centring the dialog on the content
  area in both rail modes and on the viewport on phones;
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
collapsed rail, so tooltips open over the page instead of the rail.

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
responsive={{ columns, onResolve, compactContent, compactAriaLabel, onCompactChange, nameFloorRem?, extraRem? }}
```

- `columns: ResponsiveColumn[]` (`{ id, width?, priority?, required? }`) lists the
  currently visible columns in display order. Each `width` is the same literal as its
  header cell; `rem` and `px` are measured, `%` or no width counts as the flex column
  at `nameFloorRem` (default 12).
- The shell measures itself (`useElementWidth`) and then, in order: condenses
  padding below 58rem; hides optional columns that don't fit, lowest `priority` first
  (default 50; `required` columns always stay); sizes the table's `minWidth` from the
  surviving columns; and, when even the required columns don't fit, renders
  `compactContent` (a `role="list"` labelled `compactAriaLabel`) instead of the table.
- Mark the flex (name) column and the page's core metric (time, count, points)
  `required`, so mid widths never drop them before cards engage; a leaderboard
  showing only rank and name is a bug. Mark any tutorial-spotlighted column
  `required` so auto-hide can't null its ref. Keep priorities beside the column
  records as `COLUMN_PRIORITY: Partial<Record<TColumnId, number>>`.
- `onResolve(visibleIds)` returns the surviving ids. Render
  `userVisible && resolved.has(id)` on both the header and the body (a one-sided gate
  desyncs `table-fixed` tracks). The result is render-time only: keep it out of
  persisted state and `columnVisibility`, or it overwrites the user's column prefs.
  Wrap `onResolve` in `useCallback` and `columns` in `useMemo`.
- `onCompactChange(compact)` reports the switch to cards. Hide `ColumnsMenu` and any
  sort-header control while `compact` is true.
- Header `width` literals and `ResponsiveColumn.width` values must match. A header
  forcing a width on the flex column makes the real table wider than the computed
  `minWidth` and brings back horizontal scroll.

Compact card rows show the core metric, render identity through `PlayerInfo` and
times through `CapTimeLink`, and handle skeleton and empty states themselves, since
`compactContent` replaces the whole table including `DataTableSkeletonRow` and
`DataTableEmpty`.

Reference pages: `PlayersPage.tsx`, `WorldRecordsPage.tsx`, `ServerBrowserPage.tsx`
(with ColumnsMenu and `onCompactChange`), `CapItAllPage.tsx`,
`home/LatestRecordsCard.tsx`, `mapDetail/LeaderboardCard.tsx`,
`teams/TeamActivityPanel.tsx`.

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

## CSS runtime cost

The renderer runs on phones and in Electron beside the game, so styles have a
compositor cost:

- `backdrop-blur` is the most expensive effect. The budget is the existing chrome:
  sidebar, top bar, sticky theads, modals, tooltips and popover menus, and the
  pick/ban stage's paused overlay (present only while paused). Blur one surface, never each row or card of a
  list.
- Infinite animations (`animate-pulse`, `animate-ping`, the legendary pulses) keep the
  compositor awake. Use them on singletons (a badge, one hero), never per row.
  Skeleton `animate-pulse` is fine because it exists only while loading.
- Transition `transform` / `opacity` rather than layout properties
  (`width`, `height`, `top`); the drawer slides with `translate-x` for this reason.
- Large `box-shadow` glows on hover are fine; permanent glows on hundreds of elements
  are not.
- A page stays smooth with its largest realistic dataset at the largest page size (200
  rows); a per-row effect that can't survive that doesn't ship.
