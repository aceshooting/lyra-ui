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
- **An optional-peer loader falls back to the bare module namespace.** A `*-loader.ts` reading
  `.default` off a dynamically-imported peer uses `mod.default ?? mod` (or
  `'default' in mod ? mod.default : mod`) — different bundler and CJS-interop configurations
  resolve the same package either way. For a sanitizer specifically (`dompurify-loader.ts`),
  getting this wrong means sanitization silently **no-ops instead of throwing** — a security bug,
  not an interop nit. `spreadsheet-loader.ts`/`archive-loader.ts`/`calendar-loader.ts` show the
  right shape.
- **Optional-peer load failure fails closed, visibly.** A component whose render depends on a
  peer that fails to load sets a visible, accessible error state — `role="alert"` with a
  localized message — rather than flipping a loading flag and returning, which leaves an empty
  canvas and a `console.warn` no user will see. The document viewers and `lr-qr-code` do this
  correctly. Test it by stubbing the loader to resolve `null` and asserting the shadow root shows
  `role="alert"`.
- **An empty-but-valid result is not an error.** Zero rows, zero events, an empty archive — these
  get their own part/state, never the `part="error" role="alert"` path used for a genuine fetch
  or parse failure.
- **Register a new optional peer in all three `package.json` locations:** `peerDependencies` (the
  version range); `peerDependenciesMeta.<name>.optional: true` (without this, the peer becomes
  mandatory for every consumer regardless of whether they use the feature); `devDependencies`
  (without this, the feature's own tests silently run against a mock, or never exercise the real
  package). The three loaders above show the pattern to copy.
