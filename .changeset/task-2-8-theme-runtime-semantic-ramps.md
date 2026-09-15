---
"@aceshooting/lyra-ui": major
---

Theme runtime (`@aceshooting/lyra-ui/theme.js`): the accent ramp now accepts a per-role color
record and an optional surface reference, and derives success/warning/danger/neutral ramps with
the same contrast guarantees the brand ramp already had.

Previously `setLyraTheme()`'s accent derivation accepted exactly one color and derived only the
brand ramp, mixed against two hard-coded backgrounds (`#1a1a1a` dark / `#ffffff` light) rather than
the application's own surface. There was no way to supply a different base color for `success`,
`warning`, `danger`, or `neutral`, or to retarget the mix against a real surface color, so an
application that needed the library's own guaranteed-contrast quiet/normal/loud/on-* math for those
roles had to reimplement relative-luminance, contrast-ratio, and color-mix logic outside the
library and keep it in step by hand.

`accent` is now either an absolute CSS color (unchanged shorthand for the brand role) or a per-role
record `{ brand?, success?, warning?, danger?, neutral? }`; only the roles you supply are
(re)derived, each with the same >=4.5:1 paired-foreground and >=3:1 border/focus contrast
guarantees the brand ramp already had, and a color that fails to resolve fails closed to `null` for
just that role rather than taking the others down with it. Each role's value can in turn be a bare
color (applied in both modes, as above) or a `{ light?, dark? }` map deriving that role's ramp from
a genuinely different base color per resolved mode — e.g.
`{ brand: { light: '#2563eb', dark: '#f59e0b' } }` — rather than only a different tint weight of
the same hue; an omitted branch keeps that mode's inherited/palette default. `LyraTheme` gains a new `surface` field:
an absolute CSS color used as every supplied role's mix base instead of the shipped light/dark
defaults. The pre-paint no-flash bootstrap (`lyraThemeBootstrap`/`createLyraThemeBootstrap()`)
derives from the same math, inlined self-contained as before, so the bootstrap and the runtime
setter can never drift apart.

**Migration.** `setLyraTheme({ accent: '<color>' })` and `getLyraTheme().accent` being a bare
string both keep working exactly as before — that shape is now shorthand for
`{ brand: '<color>' }`. `getLyraTheme()` and the `lr-theme-change` event detail gain a `surface`
field (`null` by default), so code that structurally compares the whole returned/emitted record
(for example `assert.deepEqual(getLyraTheme(), { mode, accent })`) needs `surface: null` added.
Pass `{ accent: <old value> }` to keep prior behaviour unchanged in every other respect.
