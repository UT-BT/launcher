---
name: add-table-column
description: >-
  Add or modify a sortable / visibility-toggleable column on an existing
  DataTable page (Maps, Players, World Records, Servers, Cap It All). Use when
  the request mentions adding a column, a new sortable field, showing/hiding a
  field, reordering columns, or a "last seen / count / rank / time" column on a
  table. Covers the column-id union, header + body cells, alignment, ColumnsMenu
  wiring, sort, and persisted column prefs.
---

# Add a table column

Tabular pages render through the `DataTable.*` primitives and own their own
column definitions. Read `agents/shared-components.md` (DataTable, ColumnsMenu)
and `agents/styling.md` (Column layout) first.

## Steps (in the page file, e.g. `app/components/pages/PlayersPage.tsx`)

1. **Extend the column-id union** (e.g. `PlayerColumnId` on Players;
   `WorldRecordsColumnId`, `ServerColumnId` elsewhere) with the new id, and add a
   label to the `columnLabels` map.
2. **Add it to the defaults** in `DEFAULT_*_STATE`: include the id in
   `columnOrder` (in the position you want) and `columnVisibility`. These are
   already in the page's `*_PREF_KEYS` in `Main.tsx`, so order + visibility
   persist automatically — no new localStorage key needed.
3. **Header cell** — add a `DataTableHeaderCell`. For a sortable column pass
   `sortable`, `sortDirection={dir('<id>')}`, `onSort={() => sort('<id>')}`.
   Per `agents/styling.md` Column layout: give every column an explicit `width`
   **except** the one flex text column; numbers → `align="right"` (+ the body
   cell uses `font-mono tabular-nums`), text → left, icons/badges/actions →
   center.
4. **Body cell** — add a matching `DataTableCell` with the same `align`. It
   inherits width from the header under `table-fixed`.
5. **Sort wiring** — if the page sorts **server-side** (Players, World Records),
   add the new id to the page's column→sort-field map (e.g. Players'
   `COLUMN_SORT_FIELD: Record<PlayerColumnId, PlayerSortField>`); the existing
   query plumbing serializes it as the request's sort param (`sort` on Players,
   `sort_by` on World Records). If it sorts **client-side** (Maps browse,
   Servers), add a branch to the comparator.
6. **Required / hidden** — add to `requiredColumns` if it must never be hidden,
   or `excludeFromList` if it's a pseudo-column not shown in the menu.
7. **Data not fetched yet?** If the field isn't in the row type, get it from the
   API first — use the `consume-api-data` skill.

## Verify

- `npx tsc --noEmit -p tsconfig.web.json` — the union change surfaces every place
  you missed.
- Smoke in `npm run dev`: toggle the column in the Columns menu, reorder it, and
  sort by it; confirm alignment matches sibling numeric/text columns.
