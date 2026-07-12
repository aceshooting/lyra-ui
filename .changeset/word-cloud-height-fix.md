---
"@aceshooting/lyra-ui": minor
---

`<lyra-word-cloud>`: fixed the rendered `<svg>` not respecting a host-assigned height —
`[part='base']` had no `block-size` rule, so the internal `svg { block-size: 100% }` resolved against
an indefinite containing-block height and fell back to the spiral layout's own intrinsic size instead,
overflowing past the host's box. `[part='base']` now constrains to `block-size: 100%`, matching the
component's own documented `<lyra-word-cloud style="height: 20rem">` usage pattern.
