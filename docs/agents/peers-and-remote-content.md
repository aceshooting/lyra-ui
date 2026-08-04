# Optional peer dependencies and remote content — lyra-ui agent reference

> Detail behind the "Optional peers and remote content" digest in [AGENTS.md](../../AGENTS.md).

Every current viewer already follows all of this (it was never written down before, so a new one
had no guidance). Skipping any of it reopens a real SSRF/XSS/DoS/race surface that no automated
gate catches.

- **Fetching and injecting a consumer-supplied `src`:** (1) gate the URL through `safeFetchUrl()`
  (`src/internal/safe-url.ts`) before ever calling `fetch()` — never a naive
  `startsWith('http')` check, which a smuggled scheme can defeat. (2) Read the response through
  `readResponseArrayBuffer`/`readResponseText` (`src/internal/resource-loader.ts`), which enforce
  a byte ceiling *before* any parser or decompressor sees the payload — never raw
  `response.arrayBuffer()`/`.text()`/`.json()` — and add your own entry/row cap when parsing can
  produce unbounded output from bounded bytes (see `MAX_ARCHIVE_ENTRIES` in
  `archive-viewer.class.ts`). (3) Run fetched markup through `DOMPurify.sanitize()`
  unconditionally before it reaches `unsafeHTML()`/`unsafeSVG()` — no branch that skips it.
  (4) Guard every state write after an `await` with a generation token captured at call start
  (`if (generation !== this.generation) return;`), so a fast `src` reassignment can't be
  clobbered by a stale, slower response.
- **Normalize an optional peer by its required capability, not by export shape alone.** When the
  package exposes a named API, validate and prefer that named capability, then validate the
  default export as an interop fallback; `pptx-loader.ts` demonstrates this for
  `PptxViewer.open`. Factory/default-shaped peers use `mod.default ?? mod` (or
  `'default' in mod ? mod.default : mod`) so different bundler and CJS-interop configurations
  resolve the same package either way. In every case, reject a candidate that lacks the callable
  capability the component needs. For a sanitizer specifically (`dompurify-loader.ts`), getting
  this wrong means sanitization silently **no-ops instead of throwing** — a security bug, not an
  interop nit. `spreadsheet-loader.ts`/`archive-loader.ts`/`calendar-loader.ts` show the
  namespace/default shape.
- **Optional-peer load failure fails closed, visibly — and the accessible announcement is a
  separate step from the visible fallback.** A component whose render depends on a peer that
  fails to load renders a visible, localized fallback rather than flipping a loading flag and
  returning, which leaves an empty canvas and a `console.warn` no user will see. That fallback is
  plain text/markup in the shadow root — `<div part="error">`/`<p>` with the localized message,
  never `role="alert"` — because a live region inside a component's own shadow root is not
  reliably announced (the same rule `docs/agents/a11y-responsive-motion.md` documents for live
  regions generally). The actual spoken announcement instead goes through the shared
  `ViewerAnnouncementController` (`src/components/viewers/viewer-announcements.ts`), which wraps
  `acquireAnnouncementSink()` (`src/internal/announcer.ts`) to mount a light-DOM live region and
  announce each state transition exactly once. `notebook-viewer.class.ts`, `svg-viewer.class.ts`,
  and `html-viewer.class.ts` all implement this identically for a missing/failed sanitizer peer:
  the visible fallback renders inline while `this.announcements.announceAssertive(...)` (or the
  equivalent `transition('load', 'error', message)` call, which resolves to the assertive sink)
  fires the announcement. Test it by stubbing the loader to resolve `null`/throw and asserting
  both halves: the shadow root's fallback element carries no `role="alert"`/`role="status"`/
  `aria-live` (see `svg-viewer.test.ts`'s `rejects unsafe URLs and emits render errors for failed
  fetches` test), and the announcement sink actually receives the message.
- **An empty-but-valid result is not an error.** Zero rows, zero events, an empty archive — these
  get their own part/state, never the `part="error"` fallback (plus its accompanying assertive
  announcement) used for a genuine fetch or parse failure.
- **Register a new optional peer in all three `package.json` locations:** `peerDependencies` (the
  version range); `peerDependenciesMeta.<name>.optional: true` (without this, the peer becomes
  mandatory for every consumer regardless of whether they use the feature); `devDependencies`
  (without this, the feature's own tests silently run against a mock, or never exercise the real
  package). The three loaders above show the pattern to copy.
