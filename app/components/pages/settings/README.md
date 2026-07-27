---
doc: settings
read_when:
  - "editing a settings panel (launcher prefs or UT99 game config)"
  - "adding a key bind, an alias, a resolution, or any UT99 ini-backed control"
  - "touching constants.ts (ALIAS_DEFINITIONS / BIND_CATEGORIES) or SettingsLayout sections"
keywords: [settings, SettingsModal, SettingsLayout, constants.ts, BIND_CATEGORIES, ALIAS_DEFINITIONS, ini, UnrealTournament.ini, SettingsSection]
provides: "the settings subsystem map: sections, the ini read/write flow, and the constants reference"
not_here:
  - "the ini IPC channel + path safety → lib/conveyor/README.md, lib/main/README.md"
  - "launcher-pref localStorage state → agents/state-patterns.md"
sections: [layout-sections, responsive-behavior, launcher-vs-game-panels, the-ini-flow, constants-ts, shared-controls]
last_verified: 2026-07-27
verify_against:
  - app/components/layout/AppLayout.tsx
  - app/components/pages/SettingsWeb.tsx
  - app/components/pages/SettingsDesktop.tsx
  - app/components/pages/settings/SettingsLayout.tsx
  - app/components/pages/settings/constants.ts
  - app/components/pages/settings/SettingsComponents.tsx
---

# Settings subsystem

Settings is a **modal, not a nav view**. `AppLayout` lazy-loads a target-specific
web or desktop modal, opened from the user dropdown or the `open-settings` window
event (optionally with an `initialSection`). Individual non-default panels are
lazy chunks so opening Settings does not load every editor. It does not go through
`navigate()`.

## Layout + sections

`SettingsLayout.tsx` owns the section rail. Sections are the `SettingsSectionId`
union — add a section by extending that union and adding a `sidebarItems` entry:

| Group | Sections |
|---|---|
| Launcher | `launcher-general`, `launcher-appearance`, `launcher-demos`, `launcher-privacy` |
| Unreal Tournament | `game-installation`, `game-player`, `game-controls`, `game-video`, `game-audio`, `game-gameplay` |

The web target renders only `launcher-appearance` and `launcher-privacy` — the
rail drops `launcher-general` / `launcher-demos` and the whole Unreal Tournament
group behind `IS_WEB`.

Each section id maps to a panel component (`GameInputSettings`,
`GameVideoSettings`, `LauncherGeneralSettings`, …).

## Responsive behavior

Two **named** containers, never viewport variants — and never the app shell's
`lg`. The modal body is
`@container/settings`; the panel scroller inside it is `@container/panel`. Names
are mandatory — nesting means an unnamed `@md:` would silently retarget to
whichever container happens to be nearest.

**The rail — `@3xl/settings` (modal body ≥ 768px).** Above it the rail and panel
sit side-by-side (the classic two-pane). Below it they become a **drill-down**:
the rail is the whole modal, tapping a section swaps in the panel full-width
with a `Back` bar. One `compactDetail` state drives it; everything else is
`@max-3xl/settings:` / `@3xl/settings:` classes, so a resize needs no listener.
Gating on the modal — not the viewport — is what keeps it monotonic: the modal
is `w-[95%] max-w-[1400px]`, which never shrinks as the viewport grows, so
widening the window can never shrink the pane or flip the layout backwards.
Parents pass `initialDetail` when Settings was opened straight to a section
(deep link / `open-settings` with a `section`) so it lands on the panel.

Desktop normally stays two-pane (`minWidth: 1280` → a 1136px modal body), but
`ui-scale` at 150% puts the CSS viewport near 853px and the body at ~762px, just
under the gate — so the Electron app *can* show the drill-down at maximum UI
scale. That is intended: a 762px body would leave the panel only 474px beside
the rail.

**Panel contents — `@md/panel` etc.** Panels size to the *pane*, not the
viewport: the pane is ~294px on a phone in drill-down and ~1064px on a wide
monitor, and neither tracks viewport width. Use `@md/panel:` / `@lg/panel:`
inside panels — **never `sm:` / `lg:`**, which read the viewport and get it
backwards. `SettingsRow` stacks label-over-control below `@md/panel`; a control
with a fixed width becomes `w-full @md/panel:w-[...]`. Controls that are already
fluid and only carry a `min-w`/`max-w` floor (key-bind buttons, progress bars)
need no change.

Anything `position: fixed` inside a panel **must** be portalled to
`document.body` — `@container` applies layout containment, which makes the
container the containing block for fixed descendants, so an inline overlay would
be trapped inside the scrolling pane. `Modal` portals; hand-rolled overlays must
call `createPortal` themselves.

Touch affordance: Tailwind v4 wraps `hover:` in `@media (hover: hover)`, so a
hover-only treatment renders as bare static text on a phone. Below
`@3xl/settings` each rail row becomes a **tile** — `rounded-xl border
border-hairline/10 bg-card/50` with a tinted icon chip and a chevron — and every
tappable control in Settings carries an `active:` state (`active:scale-[0.99]`
plus a brighter border) so a press is visibly acknowledged. The `@3xl/settings:`
resets strip the tile back to the desktop rail row; keep the background reset on
the *unselected* branch only, or it also cancels the active row's
`bg-primary/10`.

Focus follows the drill-down: hiding the focused rail button (or `Back`) drops
focus to `<body>` and out of the modal's Tab trap, so `SettingsLayout` re-homes
focus onto `Back` on drill-in and onto the active rail button on Back — but only
when the previously focused element actually went away, so desktop clicks are
never hijacked.

## Launcher vs game panels

Two kinds of panel, different storage:

- **Launcher panels** (`launcher-general`, `launcher-demos`) persist via launcher
  config or `app` IPC (e.g. `setDemoWatcherConfig`, `setWindowBehavior` for the
  System card's minimize/close-to-tray + startup options, `ui-scale` in
  localStorage) — not UT99 files.
- **Game panels** (player/controls/video/audio/gameplay) read and write the
  **UT99 `.ini` files** directly. They're **disabled until the install is valid**
  (`isGameValid` / `installationStatus === 'valid'`).

## The ini flow

Game panels are thin editors over UT99 ini keys. They read on mount and write on
change through the `ini` IPC namespace:

```ts
await window.conveyor.ini.readIniValue('UnrealTournament.ini', section, key)
await window.conveyor.ini.writeIniValue('UnrealTournament.ini', section, key, value)
```

The main process contains every path inside `{install}/System` (see
`lib/main/README.md` — `resolveWithin`) and preserves UT's exact section names.
A control = (label, ini file, section, key, value transform). Don't write ini
files any other way.

## constants.ts

The reference data that drives the game panels — **edit here, not inline in a
panel**:

- **`BIND_CATEGORIES`** — the key-bind editor's grouped rows (`Essentials`, `UTBT
  Specific Binds`, `Custom Aliases`, `Interface`). Each bind is
  `{ label, command, tooltip? }`; `command` is the literal UT bind string written
  to the ini.
- **`ALIAS_DEFINITIONS`** — named custom aliases (`rocketjump`, `hammerjump`, …)
  → their multi-step UT command strings, written to the aliases section.
- **Resolution helpers** — `gcd`, `getAvailableResolutions(w, h)` compute the
  aspect-correct resolution list for the video panel.

Adding a bind/alias/resolution option is a data edit in `constants.ts`, not new
panel logic.

## Shared controls

Use the wrappers in `SettingsComponents.tsx` (`SettingsSection`, `SettingsRow`,
toggles/sliders/dropdowns) so panels stay visually consistent — don't hand-roll
section chrome. Styling tokens still come from `agents/styling.md`; sizing
variants follow the container-query rule above.
