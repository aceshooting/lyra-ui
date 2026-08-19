---
"@aceshooting/lyra-ui": major
---

**10.0.0.** This release removes the members deprecated during 9.x, which is the whole of its
breaking surface. Everything else in 10.0.0 is additive — no component's default rendering changes,
and no existing property, event, slot, part or CSS custom property was renamed or repointed.

Removed, each with a like-for-like replacement that has shipped since 9.x:

- `confirm()`: the `tone` option on `ConfirmOptions` → `variant`. (An earlier draft of this note
  attributed the rename to `<lr-confirm-bar>`; that component's `tone` → `variant` landed in 9.x
  and left no alias, so nothing changes there in 10.0.0. The member removed here is the one on the
  `confirm()` helper in `overlays/dialog/confirm.ts`.)
- `<lr-swatch-picker>`: `options` → `items`, `label` → `accessibleLabel` (or the host `aria-label`),
  and the `SwatchOption` type → `SwatchPickerItem`.

Deliberately **kept**, so migrating consumers are not caught out:

- `<lr-icon>`'s `autoWidth` / `auto-width` stays, deprecation notice and all. Web Awesome's own
  pinned manifest still publishes `auto-width` on `wa-icon`, and a mirrored tag owes its whole
  upstream surface — dropping it classifies `wa-icon` as an `unsupported` mapping, which is a
  release blocker. Prefer `canvas="auto"`; the alias goes when upstream's does.
- The same holds for **seven more** deprecated aliases whose records say `removalNotBefore: 10.0.0`
  and which are therefore, on paper, removable now: the `base` part on `<lr-accordion-item>`,
  `<lr-file-input>`, `<lr-qr-code>`, `<lr-sparkline>` and `<lr-video-playlist>`, and the `label`
  part on `<lr-file-input>` and `<lr-known-date>`. Every one is published by the pinned upstream
  manifest, and removing them was measured against the real comparison pipeline: each produces an
  `unsupported` mapping. `<lr-qr-code>`'s `base` is the sharpest case — `sl-qr-code` publishes it as
  its ONLY part and does not deprecate it at all.

  That `10.0.0` is not a plan anyone made. Policy requires a removal to clear one whole subsequent
  major, so `10.0.0` is simply the earliest legal value for a deprecation dating to 8.x. The records
  now say so, because read literally they promised a removal that will never happen while upstream
  ships the same names.

- `lr-geojson-view` stays. It is a permanent compatibility class for the pre-v9 tag, not a
  deprecation.
- `base` / `wrapper` on `<lr-switch>` and `<lr-checkbox>` stay pointing at the control owner. They
  are Web Awesome / Shoelace compatibility names, and the library's parity contract is that a
  mirrored name keeps its meaning; `row` (new in this release) names the row wrapper instead.
