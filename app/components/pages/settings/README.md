# Settings subsystem

Settings is a modal, not a nav view, and never goes through `navigate()`. Read this before
editing a settings panel, adding a section, or adding a UT99 ini-backed control (key bind,
alias, renderer or audio option). The ini IPC and its path rule are in
[lib/main/README.md](../../../../lib/main/README.md); launcher-pref state tiers are in
[agents/state-patterns.md](../../../../agents/state-patterns.md).

`AppLayout` lazy-loads `SettingsModalWeb` or `SettingsModalDesktop`
(`app/components/modals/`) by target and mounts it only while open. It opens from the
sidebar user card or the `open-settings` window event; `detail.section` picks the initial
section.

## Sections and panels

`SettingsLayout.tsx` owns the rail: the `SettingsSectionId` union and the `sidebarItems`
list.

| Group | Sections | On web |
|---|---|---|
| Launcher | `launcher-general`, `launcher-appearance`, `launcher-demos`, `launcher-privacy` | Appearance and Privacy only |
| Unreal Tournament | `game-installation`, `game-player`, `game-controls`, `game-video`, `game-audio`, `game-gameplay` | hidden |

The section → panel mapping lives in the target shells, not the layout:
`DesktopSettings` (`app/components/pages/SettingsDesktop.tsx`, a `switch`) and
`WebSettings` (`app/components/pages/SettingsWeb.tsx`). To add a section, extend the union,
add a `sidebarItems` entry in the right `IS_WEB` branch, and add the panel to each shell
that shows it.

- **Initial section.** Desktop opens `launcher-general`; web opens `launcher-appearance`,
  or `launcher-privacy` when that is requested. A requested section also sets
  `initialDetail`, so the drill-down lands on the panel.
- **Lazy panels.** Every panel except the shell's default one (General on desktop,
  Appearance on web) is a lazy chunk, so opening Settings does not load every editor, and
  the web shell never imports a game panel.
- **Install gate.** Every Unreal Tournament section except `game-installation` is disabled
  until the install is valid (`isGameValid`, from `installationStatus === 'valid'`).
  `GameInstallationSettings` lives at `app/components/pages/GameInstallationSettings.tsx`.

## Where panels store things

- **Launcher General**: UI scale in localStorage `ui-scale` (75–150%, applied through
  `window.uiScale`), window behaviour (minimize/close-to-tray, start on startup) through
  `app.setWindowBehavior`, the Updates card and the Remove old copy row.
- **Launcher Demos**: the demo watcher through `app.get/setDemoWatcherConfig`, plus
  `AutoDemoRec` in `UTBT_UserSettings.ini` `[UserSettings]`.
- **Launcher Appearance**: theme (`useTheme`) and display timezone override; no IPC, works
  on both targets.
- **Launcher Privacy**: analytics consent (`app/utils/telemetry.ts`) and data deletion.
- **Game panels** (player, controls, video, audio, gameplay) read and write the UT99 ini
  files directly.

## The ini flow

Game panels are thin editors over UT99 ini keys. They read on mount, write on change, and
re-read when `window.utProfile.onChanged` fires:

```ts
await window.conveyor.ini.readIniValue('UnrealTournament.ini', section, key)
await window.conveyor.ini.writeIniValue('UnrealTournament.ini', section, key, value)
```

Paths are relative to `{install}/System` (`UnrealTournament.ini`, `User.ini`,
`UTBT_UserSettings.ini`) and main contains them there. A control is (label, ini file,
section, key, value transform); write ini files only through these channels. Know the
handler's behaviour: `readIniValue` returns the first of duplicated keys,
`readIniSection` returns duplicates as arrays (key binds read `User.ini` `[Engine.Input]`
this way), `writeIniValue(..., null)` deletes a key, and every write rewrites the whole
file without its comments.

## constants.ts

The reference data behind the game panels. Adding a bind, alias, resolution or device
option is a data edit here, not new panel logic.

- **`BIND_CATEGORIES`**: the key-bind editor's groups (`Essentials`,
  `UTBT Specific Binds`, `Custom Aliases`, `Interface`). Each bind is
  `{ label, command, tooltip? }`; `command` is the literal UT bind string written to
  `User.ini` `[Engine.Input]`.
- **`ALIAS_DEFINITIONS`**: alias name → multi-step UT command. Binding a command whose
  name is an alias first ensures `Aliases[n]=(Command="…",Alias="<name>")` exists in
  `[Engine.Input]` (reusing an empty slot, else the next index), then binds the key to the
  alias name.
- **`gcd`, `getAvailableResolutions(w, h)`**: the aspect-correct resolution list for the
  video panel.
- **`RENDER_DEVICE_SETTINGS`** / **`AUDIO_DEVICE_SETTINGS`**: per-device advanced controls,
  keyed by the device class exactly as it appears in `[Engine.Engine] GameRenderDevice` /
  `AudioDevice` (`D3D9Drv.D3D9RenderDevice`, `ALAudio.ALAudioSubsystem`, …). Each entry is
  a key in that device's own section with a control type (`boolean`, `number`, `select`,
  `color`) and its bounds or options. A device with no entry shows no advanced controls.
- **`LEGACY_RENDERERS`** (renderers the video panel warns about) and
  **`AUDIO_DEVICE_INFO`** (labels, descriptions, the recommended device).

## Shared controls

Build panels from `SettingsSection` and `SettingsRow` (`SettingsComponents.tsx`) for the
section chrome and rows, with the `app/components/ui/` primitives (`Switch`, `Slider`,
`Input`, `Button`) as controls. Styling tokens come from
[agents/styling.md](../../../../agents/styling.md); sizing follows the container-query
rules below.

## Responsive behaviour

Settings sizes by two named container queries, never by viewport variants or the app
shell's `lg`. Each modal wraps its body in `@container/settings`; `SettingsLayout`'s panel
scroller is `@container/panel`. Always use the names: the containers nest, so an unnamed
`@md:` would retarget to whichever container is nearest.

**The rail: `@3xl/settings` (modal body ≥ 768px).** Above it the rail and panel sit side by
side. Below it they become a drill-down: the rail fills the modal, tapping a section
swaps in the panel full-width with a `Back` bar. One `compactDetail` state drives it;
everything else is `@max-3xl/settings:` / `@3xl/settings:` classes, so a resize needs no
listener. Gating on the modal keeps it monotonic: the modal is `w-[95%] max-w-[1400px]`,
which never shrinks as the viewport grows, so widening the window never flips the layout
backwards.

Desktop normally stays two-pane (the window's `minWidth` is 1280), but at the 150% UI
scale maximum the CSS viewport is about 853px and the body lands near the gate, so the
Electron app can show the drill-down. That is intended: the panel beside the 288px rail
would be cramped.

**Panel contents: `@md/panel`, `@lg/panel`.** Panels size to the pane (about 294px on a
phone in drill-down, about 1064px on a wide monitor), which does not track the viewport.
Use `@md/panel:` / `@lg/panel:` inside panels; `sm:` / `lg:` read the viewport and get it
backwards. `SettingsRow` stacks label over control below `@md/panel`; a control with a
fixed width becomes `w-full @md/panel:w-[...]`. Fluid controls with only a `min-w`/`max-w`
floor (key-bind buttons, progress bars) need no change.

**Overlays.** `@container` applies layout containment, which makes the container the
containing block for `position: fixed` descendants, so an overlay inside a panel must be
portalled to `document.body`. `Modal` does this only with its `portal` prop (the panels'
import modals pass it); hand-rolled overlays call `createPortal` themselves, as
`GameInputSettings`' bind capture does.

**Touch.** Tailwind v4 wraps `hover:` in `@media (hover: hover)`, so a hover-only treatment
is bare static text on a phone. Below `@3xl/settings` each rail row is a tile
(`rounded-xl border border-hairline/10 bg-card/50`, a tinted icon chip, a chevron), and
every tappable control carries an `active:` state (`active:scale-[0.99]` plus a brighter
border). The `@3xl/settings:` resets strip the tile back to the desktop rail row; keep the
background reset on the unselected branch only, or it also cancels the active row's
`bg-primary/10`.

**Focus.** Hiding the focused rail button (or `Back`) drops focus to `<body>`, out of the
modal's Tab trap, so `SettingsLayout` moves focus to `Back` on drill-in and to the active
rail button on Back, but only when the previously focused element actually disappeared,
so desktop clicks are never hijacked.
