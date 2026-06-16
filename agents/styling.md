---
doc: styling
read_when:
  - "styling a new page, button, table, form, chip, card, or modal"
  - "choosing a color, radius, spacing, or animation"
  - "you see drift from a token and are tempted to add a variant"
keywords: [tailwind, cn, DataTable, tokens, colors, button, card, white/5, bg-card, animation, table-fixed, align]
provides: "the locked design tokens + the canonical class strings"
not_here:
  - "which component to use → shared-components.md"
  - "state / persistence → state-patterns.md"
sections: [class-merging, tables-locked, page-layout, filter-panel, buttons-toggle-states, form-inputs, card-backgrounds-borders, text, color-palette, animation, donts]
last_verified: 2026-06-16
verify_against: [app/components/shared/DataTable.tsx, app/styles/globals.css, lib/utils.ts]
---

# Styling reference

Design tokens + locked styling decisions. Future pages must use these patterns
to stay visually consistent. When you spot drift, fix it — don't add a new
variant.

## Class merging

Always use `cn` from `lib/utils.ts` for conditional classes. It's clsx +
tailwind-merge, so later classes win on Tailwind conflicts:

```ts
cn('px-4 py-3', condition && 'px-2')  // → 'py-3 px-2'
```

## Tables — locked

Set inside `app/components/shared/DataTable.tsx`. Don't override inline.

| Element | Class |
|---|---|
| Scroll container | `flex-1 min-h-0 bg-card/30 border border-white/5 rounded-xl overflow-auto` |
| `<table>` | `w-full text-sm` |
| `<thead>` | `sticky top-0 z-[2] bg-card/95 backdrop-blur` |
| `<thead> <tr>` | `border-b border-white/10` |
| `<th>` | `px-4 py-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider` |
| `<th>` sort button | `inline-flex items-center gap-1 hover:text-white transition-colors cursor-pointer` |
| `<tbody> <tr>` | `border-b border-white/5 hover:bg-white/[0.03] transition-colors group` |
| `<td>` | `px-4 py-3` |
| Empty state `<td>` | `px-4 py-16 text-center text-muted-foreground` — text only, no icon |

Sort icons: `ArrowUpDown` (size-3 opacity-30) when not sorted; `ChevronUp` /
`ChevronDown` (size-3 text-accent-400) when active.

### Column layout

`<table>` is `table-fixed` — **column widths come from the header row**. Give
every `DataTableHeaderCell` an explicit `width` *except* the one primary text
column (Player / Name / Map / Rusher), which stays width-less to absorb the
slack. Skip this and `table-fixed` splits every column evenly: a right-aligned
numeric column then floats its value to the far edge (the Players "rank" bug).

When the flex column can be squeezed below its content (many columns + small
window), pass `minWidth` to `DataTableShell` (sum of column widths + a floor for
the flex column) so the table scrolls horizontally instead of collapsing the
flex column into its neighbour. See `tableMinWidth` in `ServerBrowserPage.tsx`.

Align by content type:

| Content | `align` | Notes |
|---|---|---|
| Numbers — rank, points, ping, times, %, counts | `right` | + `font-mono tabular-nums` so digits line up |
| Text — name, author, role, dates | `left` (default) | |
| Icon / status badge / action buttons / difficulty / medal icon+count | `center` | reads as a unit |

Body cells inherit the column width from the header under `table-fixed`, so they
only need a matching `align`. Exception: a deliberately all-centered table with
composite stacked cells (Maps WR/PB = time + sub-label) keeps everything
`center` — internal consistency within that table wins over the cross-table rule.

## Page layout

```tsx
<div className="space-y-4 h-full flex flex-col overflow-hidden">
  <header />     {/* h1 + subtitle + icon buttons, shrink-0 */}
  <toolbar />    {/* Filters / Columns / search, shrink-0 */}
  <filterPanel /> {/* Collapsible, shrink-0 */}
  <error />      {/* Conditional banner */}
  <DataTableShell>...</DataTableShell>  {/* flex-1 min-h-0 */}
  <PaginationBar /> {/* Optional, shrink-0 */}
  <modals />
</div>
```

### Page title block

```tsx
<div className="flex items-end justify-between shrink-0">
  <div>
    <h1 className="text-2xl font-bold text-white leading-tight">{Title}</h1>
    <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
  </div>
  <div className="flex items-center gap-1">
    {/* HelpCircle tutorial button + RefreshCw button */}
  </div>
</div>
```

Icon buttons in header: `p-2 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 transition-colors cursor-pointer`.

## Filter panel

```tsx
<div className="bg-card/30 border border-white/10 rounded-xl p-4 space-y-4 shrink-0">
  <FilterPanelRow label="...">
    <MultiFilterDropdown ... />
  </FilterPanelRow>
  ...
  <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
    <FilterPresetsMenu ... onResetFilters={resetFilters} />
  </div>
</div>
```

## Buttons & toggle states

### Toolbar toggle button (Filters, etc.)

```tsx
// Inactive
"bg-card/50 border border-white/10 text-muted-foreground hover:text-white hover:border-white/20"
// Active (panel open)
"bg-accent-500/20 border border-accent-500/50 text-accent-300"
// Shared shape
"flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer"
```

Count badge inside toggle: `text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent-500 text-white`.

### Sidebar Quick Actions

Primary CTA (driving users to a key action):
```
"w-full h-11 bg-accent-500/15 border border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:text-white hover:border-accent-500/60 hover:shadow-[0_0_20px_rgba(59,130,246,0.25)] transition-all font-semibold rounded-lg"
```

Secondary action (muted):
```
"w-full h-9 bg-card/50 border border-white/10 text-muted-foreground hover:text-white hover:bg-card/80 hover:border-white/20 transition-colors rounded-lg font-medium"
```

### Action chips inside table rows (Join, Spec, etc.)

```tsx
// Primary action
"h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md uppercase text-[10px] font-bold tracking-widest"
// Ghost action
"h-7 px-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-white/5 text-[10px] font-bold uppercase tracking-widest gap-1"
```

### Active filter chips

For "what's filtered right now" pills above a data table, use
`<ActiveFilterChip>` (`app/components/shared/ActiveFilterChip.tsx`). One chip
per filter value. Pattern:

```
[LABEL: value ×]
```

Styling locked inside the component (blue-tinted, removable via X button).
Page composes the chip row from its own filter state and renders it between
the toolbar and the filter panel — only when `hasActiveFilters`.

### Color-tinted button family

| Intent | bg / border / text | Hover |
|---|---|---|
| Accent (active / primary toggle) — themeable, swaps per theme | `bg-accent-500/15 border-accent-500/40 text-accent-200` | `bg-accent-500/25 border-accent-500/60` |
| Emerald (positive / save) | `bg-emerald-500/10 border-emerald-500/30 text-emerald-300` | `bg-emerald-500/25 text-emerald-200 border-emerald-500/50` |
| Red (destructive / clear) | `bg-red-500/10 border-red-500/30 text-red-300` | `bg-red-500/25 text-red-200 border-red-500/50` |
| Rose (warning / demos) | `bg-rose-500/10 border-rose-500/30 text-rose-300` | `bg-rose-500/25 text-rose-100 border-rose-500/50` |
| Amber (warning / overtime) | `bg-amber-500/10 border-amber-500/30 text-amber-300` | — |

Shared shape for these chips: `h-8 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer flex items-center gap-2`.

## Form inputs

### Text input

```tsx
"px-3 py-2 bg-card/50 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-accent-500/50"
```

Search variant: add `pl-9` and absolute-positioned `<Search>` icon at `left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground`. Clear button (when value): absolute right-2 + `<X size-3.5>`.

### Checkbox

```tsx
<input type="checkbox" className="accent-[var(--accent-500)] cursor-pointer" />
// Yellow-accent variant for favorites
<input type="checkbox" className="accent-yellow-400 cursor-pointer" />
```

Wrapped in:
```tsx
<label className="flex items-center gap-2 px-3 py-2 bg-card/50 border border-white/10 rounded-md text-sm text-white cursor-pointer hover:border-white/20 self-end">
  <input ... />
  <span>Label</span>
  {count > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent-500/20 text-accent-300 border border-accent-500/30">{count}</span>}
</label>
```

### Native select

ALWAYS set `style={{ colorScheme: 'dark' }}` so Chromium renders dark form chrome on Windows.

## Card backgrounds + borders

| Layer | Background | Border |
|---|---|---|
| Page surface | `bg-background` (root) | — |
| Card (filter panel, scroll container) | `bg-card/30` | `border border-white/5` (or `/10` for stronger) |
| Card hover state | `bg-card/80` | `border-white/20` |
| Inline chip / badge | `bg-white/5` | `border border-white/5` |
| Sticky thead | `bg-card/95 backdrop-blur` | — |
| Modal | `bg-card` | `border border-accent-500/40` (when interactive) |

Standard radii: `rounded-xl` for big containers, `rounded-lg` for buttons / inputs, `rounded-md` for chips / small actions, `rounded` for badges.

## Text

| Use | Class |
|---|---|
| Page title | `text-2xl font-bold text-white leading-tight` |
| Section label (small caps) | `text-[10px] uppercase tracking-wider text-muted-foreground` |
| Table header | `text-xs uppercase tracking-wider font-medium text-muted-foreground` |
| Body | `text-sm` |
| Subtitle / hint | `text-xs text-muted-foreground` |
| Monospace nums (times, ping) | `font-mono tabular-nums` |
| Player / map name | `text-sm font-semibold text-white` |

## Color palette

- **accent-500 / accent-400 / accent-300** — the one **themeable** scale (chrome:
  primary action, active states, links, sort icons, count badges, CTAs, focus
  rings). Default = Classic blue, so untouched it looks like the original. See
  **Themes** below.
- **emerald-500 / emerald-300** — positive, save, "go", populated state
- **amber-300 / yellow-500** — warnings, certified/highlighted, favorites
- **red-500 / red-300** — destructive, clear, errors
- **rose-400 / rose-300** — alternate warning (full server, demos)
- **muted-foreground** — secondary text, inactive
- **white/10**, **white/5** — borders and subtle backgrounds (don't use `border-gray-*`)

### Brand colours (fixed across every theme)

Game identity, not chrome — keep these **literal**, never route through `accent-*`:

- **World record** = blue (`text-blue-300`, medal `world record`)
- **Champion** = red (`text-red-300`); rank-1 leaderboard time = red
- **Medals** — bronze `amber-500`, silver `slate-200`, gold `yellow-300`
- **Delta** — gained `emerald`, lost `red` (`DELTA_COLORS`, `capDetail/capStats.ts`)
- **Roles / Patreon / verified / certified / cap-type / team & compare-runner A-B**
  (`utils/roles.ts`, `PatreonBadge`, the `CapTypeBadge`/team/runner colours)
- **Functional** — destructive `red`, success `emerald`, warning `amber`/`rose` are
  usability constants and also overlap brand, so they stay fixed too.
- Splash / login / marketing gradients (`shared.css`, `--utbt-*`) — a brand moment.

## Themes

The accent is the **only** themeable scale. Themes swap CSS-variable *values* only —
identical structure and luminance, so there's nothing extra to QA between dark themes.
**Light** is the one exception — a genuine second target (see below).

- **Accent** `--accent-50…950` → Tailwind `accent-*`. Default (Classic) = Tailwind
  blue. Use `accent-*` for **all** chrome.
- **Surface tint** — each theme faintly hues `--card`/`--background`/`--muted`/`--border`
  at the *same* lightness as Classic (subtle, never "in your face").
- **Glow** `--accent-glow-rgb` (space-separated RGB) for arbitrary
  `drop-shadow-[…rgb(var(--accent-glow-rgb)/<a>)]` (e.g. the sidebar logo).
- **Hairline** `--color-hairline` (white on dark themes) backs `*-hairline/<n>`
  borders/fills; it flips dark in the **Light** theme.
- **Window chrome** (titlebar) is driven by the `--window-c-*` vars in
  `app/styles/window.css`, mapped to theme tokens (`--secondary`/`--popover`/
  `--foreground`/`--border`), so it follows every theme — white in Light,
  tinted-dark in the dark themes. Don't hardcode titlebar colours.

Values live in `app/styles/themes.css` (`:root` = Classic, `:root[data-theme="…"]`
for the rest). Registry + provider: `app/theme/themes.ts`, `app/theme/ThemeProvider.tsx`
(`utbt:theme:v1`). Add a theme = one `[data-theme]` block + one registry entry. Picker:
Settings → Appearance (`LauncherAppearanceSettings.tsx`).

An `exclusive: true` registry flag gates a theme to Patreon supporters (e.g. `aurum`).
The picker locks the card for non-patrons (lock + a Patreon tag, click opens
patreon.com/utbt) and only lets supporters select it. Gating reuses the already-cached
`usePatreonTier` (the current user's tier is threaded AppLayout → SettingsModal →
Settings → Appearance) — **zero extra API calls**. It's a deliberately soft, client-side
gate: the CSS exists for everyone, so a determined user could set it via localStorage.

### Light theme

`light` is a single theme (crisp white), not a per-accent mode. It's the one theme
that also toggles the `dark` class **off** (`ThemeProvider` + the `index.html`
pre-paint script); every dark theme keeps `.dark` on. `globals.css` defines
`@custom-variant dark (&:where(.dark, .dark *))` so Tailwind `dark:` is class-based.

`:root[data-theme="light"]` does three things and needs **no per-component colour
edits**:
1. flips the surface vars to light + `--hairline-rgb` to dark;
2. uses a blue accent ramp whose *text* shades (`--accent-200/300/400`) are dark;
3. overrides the brand/functional **text-shade** colour vars (`--color-blue-300`,
   `--color-red-300`, `--color-emerald-300`, …) to dark, legible values. Tailwind
   emits `text-blue-300` as `var(--color-blue-300)`, so this flips every plain
   coloured text. (Opacity variants like `text-blue-300/40` inline to a hex and
   don't flip — rare; fix per-spot if a light screenshot shows one.)

This works only because the surface sweep moved components onto the flippable
tokens: `*-hairline/<n>` (not `white/<n>`) for borders/fills and `text-foreground`
(not `text-white`) for primary text. `text-white` survives **only** on solid
coloured fills (e.g. `bg-accent-500 text-white` count badges), which stay white in
both modes.

Player **title** colours are arbitrary per-title RGB, so they're computed in JS
(`app/utils/titleStyles.ts`), not via the CSS-var override. In Light they're mapped
to a hue-preserving, saturation-boosted, luminance-targeted (~4:1 on white) jewel
tone and the dark text-outline is dropped. `PlayerInfo` recomputes them on theme
change (it reads `useTheme`), so they update live.

## Animation

- Page enter: `animate-in fade-in slide-in-from-bottom-0 duration-500` (page-level)
- Modal: `animate-in fade-in zoom-in-95 duration-200`
- Tutorial card: `animate-in fade-in slide-in-from-bottom-4 duration-200`
- Skeleton: `animate-pulse` with `bg-white/5`
- Legendary title/avatar: `legendaryAvatarPulse` / `legendaryTitlePulse` keyframes in `globals.css`

## Don'ts

- Don't `text-gray-*` — use `text-muted-foreground` or `text-white/*`.
- Don't `border-gray-*` — use `border-white/5` or `border-white/10`.
- Don't `bg-gray-*` for cards — use `bg-card/<n>`.
- Don't hardcode `blue-*` for chrome — use `accent-*` (themeable). Leave brand /
  functional colours (WR blue, champion/danger red, emerald, amber, rose) literal.
- Don't hardcode dark hex backgrounds (`bg-[#0a0a0b]`, `bg-[#0f1115]`) — use
  `bg-card` / `bg-popover` so modals + `<option>`s flip in the Light theme. Use
  `*-hairline/<n>` not `white/<n>`, and `text-foreground` not `text-white` (except
  text on a solid colour fill, which stays white).
- Don't re-roll table styling inline — use `DataTable.*` primitives.
- Don't re-roll preset menus, columns menus, player avatars, map thumbnails, favorite stars — use the shared components.
- Don't put rarity/title styling outside `PlayerInfo`.
- Don't put score-color thresholds outside `scoreColors.ts`.
