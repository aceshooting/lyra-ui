---
"@aceshooting/lyra-gen": minor
---

Chat islands can preview while they stream. `createChatStream({ progressive: true })` (or `{ minCodeUnits }`) gives each `loading` island a `partial` view: a validated, only-growing preview of the fenced `lyra` block received so far, carrying the surface and revision of the committed document and with host source authorization already applied. Hosts pass it to the island's `lr-gen-view` as `.partial`, which renders inert until the committed `.document` of the same surface and revision replaces it. Cancellation, interruption, rejection and invalid islands clear the preview and keep their existing fallbacks, previews never contain nodes absent from or invalid in the source, and the committed document is identical with or without the option. `createIslandParser()` accepts the same opt-in as `progressive: { catalog, minCodeUnits? }` and exposes the preview on the open island part.
