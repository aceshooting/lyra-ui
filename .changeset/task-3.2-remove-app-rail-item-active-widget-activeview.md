---
"@aceshooting/lyra-ui": major
---

Remove two long-deprecated compatibility aliases: `<lr-app-rail-item>`'s `active`
property/attribute and `<lr-widget>`'s `activeView` property.

Both were restored in 11.2.0 after shipping as undocumented dead expandos (a Lit property binding
on a custom element is untyped, so a silent rename breaks no type check, no test, and no build).
Each carried a `removalNotBefore: '13.0.0'` compatibility window, which has now passed by three
major versions.

**Migration.**

`<lr-app-rail-item active>`/`.active` no longer exist — use `current`/`.current`, which has been
available since 11.2.0. Setting `active` now has no effect: the attribute is unrecognized and the
property is a plain, unobserved expando.

`<lr-widget>.activeView` no longer exists — use `.activeViewId`, available since 11.2.0. Setting
`activeView` now has no effect: it no longer seeds `activeViewId`.

The other eight deprecated-alias records reviewed for this release remain — each is tied to Web
Awesome or Shoelace still shipping its own equivalent deprecated name upstream (`lr-accordion-item`'s
`base` part, `lr-file-input`'s `base` and `label` parts, `lr-icon`'s `autoWidth`/`auto-width`,
`lr-known-date`'s `label` part, `lr-qr-code`'s `base` part, `lr-sparkline`'s `base` part, and
`lr-video-playlist`'s `base` part), confirmed still present in the pinned Web Awesome 3.11.0 /
Shoelace 2.20.1 manifests and (for the three Pro-tier components without a published manifest)
the current Web Awesome documentation pages.
