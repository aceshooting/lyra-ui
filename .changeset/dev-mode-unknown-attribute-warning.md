---
"@aceshooting/lyra-ui": patch
---

Add a dev-mode console warning when an `lr-*` element is connected with an attribute it doesn't
observe.

A typo'd or renamed attribute previously failed silently: the browser stores it inertly, the
component keeps rendering its default, and nothing signals the mismatch, in any environment. In
development only -- gated on Lit's own dev-mode signal (`globalThis.litIssuedWarnings`, already
populated whenever a consumer's bundler resolves `lit`'s `development` build, exactly as it
already does for Lit's own dev-mode warnings) -- each `lr-*` component now warns once per
`(tag, attribute-name)` for an attribute outside its observed set, with a did-you-mean suggestion
when a close match exists: `` `<lr-lite-chart>: unknown attribute 'hide-axis' — did you mean
'without-value-axis'?` ``. Global HTML attributes (`class`, `id`, `style`, `hidden`, `slot`,
`part`, ...), `data-*`, and `aria-*` are always exempt. No production behavior change -- the
check is fully inert when Lit's own dev-mode signal isn't present.

Scoped to attributes only; an unrecognized `.property =` write is not detected (there is no safe
way to intercept it generically without either enumerating instance properties -- which floods
false positives against this codebase's extensive use of TypeScript's `private` keyword for
internal state -- or wrapping every instance in a Proxy, which cannot intercept parser-driven
custom-element upgrades).
