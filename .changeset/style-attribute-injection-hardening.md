---
"@aceshooting/lyra-ui": patch
---

Harden three components against untrusted values reaching CSS/URL sinks unvalidated:

- `lr-terminal` and `lr-notebook-viewer`'s shared ANSI-segment styling (`segmentStyle()`) wrote a
  parsed stream's `fg`/`bg` color tokens directly into an inline `style` declaration; a
  crafted ANSI color escape could inject CSS syntax. Both now validate through
  `sanitizeCssColor()` before the value reaches `styleMap()`.
- `lr-widget-renderer`'s agent-authored widget tree wrote an arbitrary `align` prop string
  directly into `align-items` with no allowlist. Now normalized through a bounded value map;
  an unrecognized value renders as unset rather than reaching the declaration list.
- `lr-mcp-app`'s `open-link` message handler forwarded a `postMessage`-supplied `href` to
  consumers verbatim as long as it was a string, with no scheme validation. Now validated through
  `safeLinkHref()` (rejects `javascript:`/other unsafe schemes) before the `lr-mcp-open-link`
  event fires.
