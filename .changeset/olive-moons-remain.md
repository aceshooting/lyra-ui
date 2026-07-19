---
"@aceshooting/lyra-ui": patch
---

Add an internal `resolveCssLength()` helper that resolves a CSS length (a bare/`px` number, `rem`,
or `em`) to pixels, reading the document root font size at call time so a `rem`-authored threshold
tracks browser zoom, a user font-size preference, or an app changing its base size. Units that only
make sense against a different reference box (`%`, `vw`/`vh`, `ch`), absolute units, and
`calc()`/`var()` expressions resolve to `undefined`, which callers treat as "unset".

No public API change yet — this is the shared groundwork for letting `lr-split` and `lr-stepper`
accept `orientation-breakpoint` as a CSS length.
