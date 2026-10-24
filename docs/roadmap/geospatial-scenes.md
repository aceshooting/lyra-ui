# Geospatial scenes and synchronized playback

Status: planned and unstarted, after 30.0.0. None of this work is a 30.0.0 release requirement.
P1 and P2 indicate priority, not a promised release version or date. Public API names, package
ownership and implementation scope require a separate specification before implementation.

The unpublished 30.1.0 candidate adds experimental independently owned map anchors and maintenance
corrections; it does not implement any P1 or P2 item below. Their specification, ownership and
qualification remain separate work.

## Existing foundation

`lr-map` already accepts globe projection and terrain through `mapStyle`; the optional
`@aceshooting/lyra-map` engine prepares those features on demand. Its native globe and terrain
controls are available through the engine. This plan improves component-level configuration,
composition and examples; it does not introduce another map renderer.

`lr-sequence-playback` already provides a stable-index sequence stepper, play/pause and a slider.
The work below adds time binding and synchronization around that control. The optional 3D engines
and `lr-model-viewer` provide further foundations, but a standalone model viewer does not place a
model at a geographic location on a globe.

Related plans: [map adoption](map-adoption.md) and [WebGL 3D views](lyra-3d.md).

## P1

- [ ] **Typed globe and terrain configuration.** Expose coherent settings and controls for
  projection, terrain and terrain exaggeration through the component, building on existing style
  support. Add a complete example covering flat/globe switching, terrain, overlays, camera moves,
  loading and fallback states, and themed accessible controls.
- [ ] **Altitude-aware geometry and georeferenced models.** Support markers, paths, arcs and models
  positioned by geographic coordinates and altitude. Specify altitude units and reference frames,
  terrain-relative versus absolute placement, interpolation, occlusion, picking and labels before
  implementation. Keep the geographic scene contract distinct from standalone model viewing.
- [ ] **A shared simulation clock and time binding.** Extend composition around
  `lr-sequence-playback` so a selected instant drives maps, tracks, charts and detail panels
  consistently. Specify timestamp/index mapping, irregular samples, interpolation, seeking,
  playback speed and live/replay transitions. Time-zone display belongs to presentation; the
  shared instant must remain unambiguous.

## P2

- [ ] **Supported custom 3D layer integration.** Provide a documented bridge for optional beams,
  coverage cones, clouds and particles. Define geographic transforms, globe/terrain compatibility,
  shared camera and picking, style replay, resource disposal and context-loss recovery. Keep
  optional rendering engines and effects out of ordinary map imports.
- [ ] **Camera tours, object tracking and saved viewpoints.** Compose deliberate camera transitions
  and follow modes with existing camera commands. Define how user gestures interrupt a tour or
  tracking, how viewpoints are restored, and how reduced motion changes the experience.
- [ ] **A generic network-monitoring showcase.** Build a reusable example with synthetic stations,
  moving objects, links, environmental overlays, availability history and detail panels. Show
  synchronized playback, responsive layout, themes, localization, keyboard operation and loading,
  empty and failure states. Keep example data and domain-specific calculations outside core UI.

## Boundaries and qualification

Orbital propagation, line-of-sight calculations, optical-link physics and environmental simulation
remain application logic or separately scoped optional extensions. Rendering a beam or coverage
cone does not imply that the library computes its physical validity.

Each increment needs a reviewed contract, granular imports, documentation and stories, three-engine
behavioral coverage, keyboard and text alternatives, localization and RTL, reduced-motion behavior,
and bounded lifecycle/resource handling. Measure representative scene sizes, interaction latency,
delivery cost and real-GPU performance before making scale claims. Preserve useful fallbacks when
WebGL, terrain data or an optional engine is unavailable.
