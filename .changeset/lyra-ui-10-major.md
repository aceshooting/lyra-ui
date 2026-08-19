---
"@aceshooting/lyra-ui": major
---

**10.0.0.** This release removes the members deprecated during 9.x, which is the whole of its
breaking surface. Everything else in 10.0.0 is additive — no component's default rendering changes,
and no existing property, event, slot, part or CSS custom property was renamed or repointed.

Removed, each with a like-for-like replacement that has shipped since 9.x:

- `<lr-confirm-bar>`: `tone` → `variant`. It was documented as a one-major back-compat alias, and
  `variant` already won when both were set.
- `<lr-swatch-picker>`: `options` → `items`, `label` → `accessibleLabel` (or the host `aria-label`),
  and the `SwatchOption` type → `SwatchPickerItem`.

Deliberately **kept**, so migrating consumers are not caught out:

- `<lr-icon>`'s `autoWidth` / `auto-width` stays, deprecation notice and all. Web Awesome's own
  pinned manifest still publishes `auto-width` on `wa-icon`, and a mirrored tag owes its whole
  upstream surface — dropping it classifies `wa-icon` as an `unsupported` mapping, which is a
  release blocker. Prefer `canvas="auto"`; the alias goes when upstream's does.

- `lr-geojson-view` stays. It is a permanent compatibility class for the pre-v9 tag, not a
  deprecation.
- `base` / `wrapper` on `<lr-switch>` and `<lr-checkbox>` stay pointing at the control owner. They
  are Web Awesome / Shoelace compatibility names, and the library's parity contract is that a
  mirrored name keeps its meaning; `row` (new in this release) names the row wrapper instead.
