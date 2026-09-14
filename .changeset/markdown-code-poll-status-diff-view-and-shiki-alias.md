---
"@aceshooting/lyra-ui": minor
---

Add missing theming hooks to `lr-markdown`/`lr-markdown-core` and `lr-poll-status`, a scroll-height
cap to `lr-diff-view`, and fix a shiki `languages` map key silently never highlighting — every new
token byte-identical when unset.

- `lr-markdown`/`lr-markdown-core`: `--lr-markdown-code-bg` makes the background shared by inline
  `code` spans and the fenced `code-block` surface themeable (previously a hardcoded
  `var(--lr-color-brand-quiet)` in both places, with no override hook); `--lr-markdown-code-padding`/
  `--lr-markdown-code-radius` and `--lr-markdown-code-block-padding`/`--lr-markdown-code-block-radius`
  make the previously-hardcoded inline-code and code-block padding/radius themeable too.
- `lr-poll-status`: the built-in `pause-button`'s hover/pressed paint, previously hardcoded straight
  against the shared `--lr-color-brand-quiet`/`--lr-color-brand` tokens, now reads
  `--lr-poll-status-pause-hover-bg`/`--lr-poll-status-pause-hover-color` and
  `--lr-poll-status-pause-active-bg`/`--lr-poll-status-pause-active-color`, so a consumer can retheme
  just this control without repainting every other brand-quiet surface.
- `lr-diff-view`: a new `maxHeight` property (attribute `max-height`) and `--lr-diff-view-max-height`
  token (default `none`) let the view cap its own scroll height and scroll internally instead of
  growing the page, mirroring `lr-json-viewer`'s identical `maxHeight` property/token pair.
- Fixed a shiki `languages` map entry keyed by anything other than the grammar's own registered
  `name`/`aliases` (e.g. reusing a TypeScript grammar under the key `tsx`) silently never
  highlighting in `lr-markdown`/`lr-markdown-core`, `lr-code-block`/`lr-code-block-core`, and
  `lr-diff-view` — shiki's registry resolved the map key strictly against each grammar's own
  name/aliases and threw `Language \`...\` not found`, which every caller here caught and downgraded
  to the plain-text fallback with no visible error. A `langAlias` map is now derived for exactly the
  keys that need it and passed to shiki's fine-grained `createHighlighterCore()`, so the author's
  chosen key highlights.
