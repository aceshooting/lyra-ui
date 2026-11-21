# Map adoption (`lr-map`, `@aceshooting/lyra-map` 1.3.1)

Status (2026-10-25): the camera, overlays, composition, ordering, controls, labels and lazy
construction APIs and their migration documentation shipped in
[lyra-ui 30.0.0](https://github.com/aceshooting/lyra-ui/releases/tag/lyra-ui%4030.0.0) with
lyra-map 1.3.0. The published source is `578919f6a61a31612a0382c02cbae84202466837`.
Installed-package font and label rendering, selected application prototypes, visual review and
the release's request acceptance are complete within the archived scope. Versioned release
qualification and publication are complete; complete application migration remains separate.

The completed camera, overlay, raw-engine, documentation and release-gate checklists (30.0.0 to
30.2.0) are [archived](../archive/roadmap/map-adoption.md). Caller responsibilities remain
explicit: direction-aware custom legend layout and, for direct engine scene transactions, the
documented bounded presentation repaint. These must be carried into the later application migration.

## Application migration (after the 30.0.0 release)

Maintained applications that build on the raw engine move to `lr-map` once the archived items ship,
deleting their engine workarounds (style-reload re-adding, z-order tables, dummy feature
preparation, hand-clamped popups, selector-based control relabelling, SVG rasterization, startup
timers and engine CSS overrides):

- [ ] Main site application and its shared map package.
- [ ] World site application.
- [ ] Regional site application (a separate fork of the main site's map package; re-sync first).
- [ ] Applications already on `lr-map` drop the workarounds listed in the archived checklists.

## Exit

Every item has JSDoc, three-engine tests, a story and `llms/media.md` coverage; maintained
applications drop the corresponding workarounds in the consumer rollout after the release.
