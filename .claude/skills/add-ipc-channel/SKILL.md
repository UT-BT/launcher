---
name: add-ipc-channel
description: >-
  Add a new Conveyor IPC channel so the renderer can call the Electron main
  process (filesystem, child process, OS dialog, network from main, config).
  Use when the request needs the renderer to do something only the main process
  can — read/write a file, spawn the game, open a dialog, read OS info, persist
  launcher config — and there's no existing window.conveyor.* method for it.
  Covers the api + handler + schema triple and the three registration points.
---

# Add an IPC channel

Each channel is a triple (api method ↔ Zod schema ↔ main handler) sharing one
channel name. Read `lib/conveyor/README.md` first. The most common failure is
forgetting one of the **three registration points** — do them in this order.

For a channel named `doThing`:

## 1. Schema — `lib/conveyor/schemas/<ns>-schema.ts`

```ts
doThing: {
  args: z.tuple([z.string()]),          // validate every arg
  return: z.object({ ok: z.boolean() }),
}
```
Make sure that schema object is spread into `ipcSchemas` in
`lib/conveyor/schemas/index.ts` (**registration point 1**). Zod validates args +
return on the main side, so this is the contract.

## 2. API method — `lib/conveyor/api/<ns>-api.ts`

```ts
doThing = (name: string) => this.invoke('doThing', name)
```
Make sure the class is in the `conveyor` object in `lib/conveyor/api/index.ts`
(**registration point 2**). The `window.conveyor` global type is auto-derived —
no manual type edits.

## 3. Handler — `lib/conveyor/handlers/<ns>-handler.ts`

```ts
handle('doThing', async (name: string) => {
  // validate untrusted input — paths via resolveWithin (see lib/main/README.md)
  return { ok: true }
})
```
Make sure `register<Ns>Handlers(mainWindow)` is called in
`lib/main/app.ts → createAppWindow` (**registration point 3**).

## Conventions

- **Match the namespace's channel-name style** (`window-*` kebab, `updater:*`
  colon, game/ini/maps/app camelCase) — see `lib/conveyor/README.md`.
- **Handlers are the security boundary.** Validate paths (`resolveWithin`), IPs,
  and any renderer-supplied string before touching the fs or `spawn`.
- In the renderer, call `window.conveyor.<ns>.doThing(...)`; wrap in a hook if
  used in more than one place.

## Verify

- `npx tsc --noEmit -p tsconfig.web.json` — types flow end-to-end through the
  shared schema; a missing registration or arg-type mismatch shows up here.
- `npm run dev`: call it and confirm the result; a Zod failure logs
  `IPC Error in doThing`.
