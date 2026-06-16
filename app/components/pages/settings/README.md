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
sections: [layout-sections, launcher-vs-game-panels, the-ini-flow, constants-ts, shared-controls]
last_verified: 2026-06-16
verify_against:
  - app/components/pages/settings/SettingsLayout.tsx
  - app/components/pages/settings/constants.ts
  - app/components/pages/settings/SettingsComponents.tsx
---

# Settings subsystem

Settings is a **modal, not a nav view** — `SettingsModal` is mounted in
`AppLayout` and opened from the user dropdown or the `open-settings` window event
(optionally with an `initialSection`). It does not go through `navigate()`.

## Layout + sections

`SettingsLayout.tsx` owns the section rail. Sections are the `SettingsSectionId`
union — add a section by extending that union and adding a `sidebarItems` entry:

| Group | Sections |
|---|---|
| Launcher | `launcher-general`, `launcher-demos` |
| Unreal Tournament | `game-installation`, `game-player`, `game-controls`, `game-video`, `game-audio`, `game-gameplay` |

Each section id maps to a panel component (`GameInputSettings`,
`GameVideoSettings`, `LauncherGeneralSettings`, …).

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
section chrome. Styling tokens still come from `agents/styling.md`.
