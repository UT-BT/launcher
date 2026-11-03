---
name: add-table-column
description: >-
  Add or modify a sortable / visibility-toggleable column on an existing
  DataTable page (Maps, Players, World Records, Servers, Cap It All). Use when
  the request mentions adding a column, a new sortable field, showing/hiding a
  field, reordering columns, or a "last seen / count / rank / time" column on a
  table. Covers the column-id union, header + body cells, alignment, ColumnsMenu
  wiring, sort, persisted column prefs, and the column's phone-card tier and
  panel label.
---

# Add a table column

Tabular pages render through the `DataTable.*` primitives and own their own
column definitions. Read `agents/shared-components.md` (DataTable, Column tiers
and phone cards, ColumnsMenu) and `agents/styling.md` (Column widths and
alignment) first.

Every column must declare a **tier** and a **panel label**; `npm run
typecheck:web` rejects a `ResponsiveColumn` without them. Phone cards then pick
the column up with no card code.

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
   Per `agents/styling.md` Column widths and alignment: give every column an explicit `width`
   **except** the one flex text column; numbers → `align="right"` (+ the body
   cell uses `font-mono tabular-nums`), text → left, icons/badges/actions →
   center.
4. **Body cell** — add a matching `DataTableCell` with the same `align`. It
   inherits width from the header under `table-fixed`.
5. **Sort wiring** — if the page sorts **server-side** (Players, World Records),
   add the new id to the page's column→sort-field map (e.g. Players'
   `COLUMN_SORT_FIELD: Record<PlayerColumnId, PlayerSortField>`); the existing
   query plumbing serializes it as the request's sort param (`sort` on Players,
   `sort_by` on World Records). If it sorts **client-side** (Servers), add a
   branch to the comparator. Maps does both: the server sorts by name, added and
   difficulty, and any other sort switches the page to its full-load mode, which
   sorts client-side (`agents/features/records.md`).
6. **Required / hidden** — add to `requiredColumns` if it must never be hidden,
   or `excludeFromList` if it's a pseudo-column not shown in the menu.
7. **Responsive priority** — these pages pass `responsive` to `DataTableShell`
   and render through an effective-visibility gate (`effectiveColumns` /
   `isEffectivelyVisible`), so a new column auto-participates in width-driven
   auto-hide. Add a `COLUMN_PRIORITY` entry (higher = kept longer; omit for a
   mid default; only `required` columns always stay, so a new flex column needs
   `required`). The new width you set
   in step 3 is what the resolver charges it. If the column carries a tutorial
   ref, mark it `required` in the responsive descriptor. See `styling.md` →
   Responsive columns.
8. **Tier, label and cell (required)** — in the page's tier map (e.g.
   `COLUMN_TIER`; admin tables declare `tier` on the `AdminColumn`) pick one:
   - `essential`: the card face shows it. Only for the table's few key fields.
   - `detail`: the card's expand panel lists it under its `label`. The default
     for everything else, including action columns (watch, download, history).
   - `decorative`: the touch rule may drop it, for a thumbnail that repeats the
     name or a bar that repeats a number.

   Give it a short panel `label` (the panel's term and the card sort field's
   name; usually the header text) and a `cell(row)` that returns the cell
   content without the `<td>`. Render the table's `DataTableCell` from the same
   `cell`, so table and panel can't drift. Add the sort field as `sortKey` if the
   column sorts; the card sort control lists it. Pass the column even while the
   user hides it in Columns, flagged `hiddenByUser`, never filtered out: the
   cards must still list it.
9. **Review the card face.** The face holds the table's essential fields: at
   most about four data fields, plus the favourite and status badges
   (`agents/shared-components.md` → Column tiers and phone cards; the table's
   feature doc lists its face). If the new column is `essential`, add it to the
   page's `cards.face` renderer and check the face still fits that rule; if the
   face would grow past it, make the column `detail` instead, or ask the owner
   which field leaves the face. A `detail` column needs no face change. A
   `tableOnly` table (the cap page's numeric tables) has no cards: mark the
   column `essential` and check the table still fits 360 px.
10. **Data not fetched yet?** If the field isn't in the row type, get it from the
   API first — use the `consume-api-data` skill.

## Verify

- `npm run typecheck:web` — the union change surfaces every place
  you missed.
- Smoke in `npm run dev`: toggle the column in the Columns menu, reorder it, and
  sort by it; confirm alignment matches sibling numeric/text columns. Narrow the
  window — confirm the column auto-hides at the priority you gave it (header and
  body drop together).
- Both targets, all widths: if the new column carries the page's core metric,
  mark it `required`, make it `essential` and put it on the card face — a phone
  user must still see it (`agents/styling.md` → Responsive columns).
  Check at 390px via `npm run dev:web` that the card face shows the essential
  fields, the Details panel lists the new column under its label (also when it
  is hidden in Columns), the card sort offers it if it sorts, and the table never
  scrolls horizontally.
- Update the card spec that pins the table's panel terms or sort fields (the
  table's feature doc names it), and the feature doc's face or panel list.
