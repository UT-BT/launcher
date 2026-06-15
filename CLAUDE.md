# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in the UTBT launcher repo.

## Project

Electron desktop launcher for UTBT (UT99 Bunny Track). React 19 + Vite 7 +
TypeScript + Tailwind 4. Built with `electron-vite`. Renderer code lives under
`app/`; main-process code under `lib/main/`.

## Topic docs (`agents/`)

Read the relevant one before working in that area. Don't duplicate their
content here.

- **`agents/build.md`** — npm scripts, node version, pre-commit checklist.
- **`agents/shared-components.md`** — every shared component + when to use
  it. **Required reading before adding JSX or extracting a new component.**
- **`agents/styling.md`** — locked design tokens (table styling, button
  variants, card backgrounds, color palette). **Required reading before
  styling anything.**
- **`agents/data-sources.md`** — DataService endpoints, avatar / map / flag
  URLs, Electron IPC bridge, favorites sync model.
- **`agents/state-patterns.md`** — controlled-page pattern, localStorage
  versioned keys, presets, tutorial state.

## Hard rules (don't break these)

1. **`PlayerInfo` is mandatory for every player display.** Never render `alias`
   as raw text or hand-roll an avatar `<img>`. See `agents/shared-components.md`.
2. **Tables use `DataTable.*` primitives.** Don't write inline `<th>` / `<td>`
   styling. See `agents/styling.md`.
3. **Use `cn` from `lib/utils.ts`** for any conditional class composition. It
   handles Tailwind conflicts via tailwind-merge.
4. **Native `<select>` needs `style={{ colorScheme: 'dark' }}`** so Chromium
   renders dark form chrome on Windows.
5. **Modals use `app/components/ui/modal.tsx`** with `offsetSidebar` when the
   modal should respect the navigation rail.
6. **Persist UI state in the right tier.** Primary-page state → hoisted-state-in-
   `Main.tsx` with a versioned `utbt:<thing>:v<n>` key and merge-over-defaults
   loader. Detail-page transient UI state (tab/search/sort/pagination/scroll/
   expansion) → `useNavState` (per navigation-history entry, NOT localStorage).
   **All navigation goes through `navigate()` in `Main.tsx`** — never a raw
   `setCurrentView`, never a second back/forward mechanism. See
   `agents/state-patterns.md`.
7. **Don't `text-gray-*` / `bg-gray-*` / `border-gray-*`.** Use the
   `muted-foreground` / `white/<n>` / `card/<n>` tokens. See
   `agents/styling.md`.
8. **Extend the backend** when launcher needs exceed the API rather than
   working around in the renderer (see `MapReview.json()` pattern in
   `DataService/data_service/endpoints/map_review/model.py`).

## When you change something covered by an agents doc

If you change a shared component's API, lock a new design token, or change a
state-persistence pattern, **update the relevant `agents/*.md` in the same
change**. Docs that lag behind code stop being trustworthy.
