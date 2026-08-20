---
"@aceshooting/lyra-ui": minor
"@aceshooting/lyra-flags": minor
---

Added a first-class bulk-resolution path for `<lr-flag>`, for a page that renders most/all flags at
once (a country table, a full locale picker) instead of independently resolving each instance:

- `@aceshooting/lyra-flags` gained `createFlagUrlResolver()`, a `flagUrl`-shaped resolver factory
  backed by one shared `flagUrls()` fetch instead of a fresh per-code lazy resolution per call.
- `@aceshooting/lyra-ui` gained `flag-peer-bulk.js` (`components/media/flag/flag-peer-bulk.js`), an
  opt-in alternative peer-registration entry point to the default `flag-peer.js` — import one or the
  other, never both. Only worthwhile when the page renders most/all flags; `flag-peer.js` remains
  the right default for a handful of flags. `fidelity="compact"/"detailed"` on individual elements
  still resolves correctly either way — only the standard tier is bulk-fetched.
