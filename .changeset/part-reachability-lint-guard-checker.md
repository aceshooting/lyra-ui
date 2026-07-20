---
"@aceshooting/lyra-ui": patch
---

Add a build-time guard against `::part()` CSS that parses but never matches.

Two classes of silently-inert rule are now caught by `pnpm lint` (a new
`scripts/check-part-reachability.mjs` in the contract-policy chain), neither of which any existing
check — TypeScript, the style policy, or a test that inspects stylesheet text — could see:

- **`cross-root-part`** — a component that mounts `<lr-virtual-list>` and hands it a
  `renderItem`/`renderGroup` callback renders those rows into *that element's* shadow root, so a
  bare `[part='x']` selector in the composing component's own stylesheet can never match them. The
  checker cross-references the literal part names emitted from the callback (following the class
  members it reaches) against the bare `[part]` selectors in the sibling `*.styles.ts`, and reports
  any name that has no `lr-virtual-list::part(x)` rule anywhere in that file. Components that
  legitimately render the same part into both roots — below/above a virtualization threshold, or a
  directly-rendered header row — carry both selectors and are not flagged; a
  `policy-allow(cross-root-part):` comment covers anything else.
- **`part-compound`** — per Selectors L4 a pseudo-element may only be followed by pseudo-classes, so
  `::part(a)[attr]`, `::part(a).cls`, `::part(a) .descendant` and `::part(a) > .child` parse and
  then match nothing. Every `*.styles.ts` is scanned for those shapes; `::part(a):hover`,
  `::part(a)::selection` and the part-list form `::part(a b)` remain valid and pass.

No component behavior changes; the library is clean under both rules today.
