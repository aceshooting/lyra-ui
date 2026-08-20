---
"@aceshooting/lyra-ui": minor
---

`<lr-map>`'s `dataLayers` gained declarative marker clustering and a heatmap layer kind. Both are
strictly additive — today's behaviour is the default in each.

`cluster?: { radius?, maxZoom?, radiusSteps?, colorSteps?, countFont? }` opts an entry into
MapLibre's native clustering: the source gains `cluster`/`clusterRadius`/`clusterMaxZoom` and the
entry emits a cluster circle layer, a count symbol layer, and a circle layer for points that stayed
unclustered. `markers` creates one `maplibregl.Marker` per entry, which is right for tens of pins and
wrong for thousands — a consumer rendering up to 5,000 listings in a country-sized viewport got 5,000
DOM nodes and an unreadable map. `radiusSteps`/`colorSteps` are `['step', …]` breaks on `point_count`
in the same ascending `[value, output]` vocabulary `choropleth.stops` already uses, including the
same "the first stop's output is also the base" rule.

`kind?: 'auto' | 'heatmap'` plus `heatmap?: { weightField?, weightRange?, stops?, radius?, intensity? }`
reaches MapLibre's first-class `heatmap` layer type. `dataLayers` emitted exactly three
geometry-filtered layers — fill, line and circle — so a weighted-point density surface was
unreachable declaratively even though the peer implements it. The colour ramp reuses the same
`[value, color]` stop vocabulary `choropleth.stops` and `legendGradient` share.

Between them these were the only remaining reason for raw MapLibre in at least one consumer, which
carried roughly 212 lines behind the `.map` escape hatch — plus a `style.load` listener and
idempotent remove-then-add, because a basemap swap wipes every layer and `<lr-map>` restored only its
own. Both new renderings join the component's existing re-application path, so a `mapStyle` swap
restores them too.
