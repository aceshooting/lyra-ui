---
"@aceshooting/lyra-ui": minor
---

Four consumer-filed defects, plus one the sweep for the same defect class turned up.

**`<lr-checkbox-group>`: `value` is settable.** It was a getter with no setter. Reading was fine,
but `.value=${...}` — the binding every other form control here accepts — compiles to a plain
property assignment that `readonly` cannot catch at the binding site, so it threw
"Cannot set property value ... which has only a getter" from inside lit-html during a *later*
render, blaming framework internals rather than the offending line. Assigning now mirrors the array
onto the owned checkboxes; it is controlled input, so it emits no `lr-change`, and an assignment
made before the children exist is applied once they arrive.

**`<lr-time-input>`: `valueAsNumber` and `valueAsDate` are settable.** Nobody filed this — sweeping
the library for the same "public getter a consumer would naturally bind, with no setter" shape found
it. `<lr-input>`, `<lr-date-picker>`, `<lr-slider>` and `<lr-known-date>` all ship both, and the
native `<input type="time">` this mirrors accepts both; `<lr-time-input>` was the lone outlier.
Out-of-range or non-finite figures clear the field rather than wrapping into a different time.

**`<lr-map>`: `lr-map-click` resolves `feature` against `dataLayers`, not only the choropleth.**
Clicking a shape painted through `dataLayers` reported `feature: undefined`, indistinguishable from
clicking empty ocean — which broke the pattern the two properties invite: choropleth for features
that have a value, a data layer for features that exist but have none. The detail gains `origin`
(`'choropleth' | 'data-layer'`) and `sourceId` (the authored `dataLayers[].sourceId`) so a hit is
attributable.

**`<lr-map>`: an untileable numeric feature property is now named up front.** MapLibre GL tiles
GeoJSON through a worker, where an oversized integer throws "Given varint doesn't fit into 10
bytes" — uncatchable by the app, invisible except as an opaque message, and with the rest of the
layer still painting. Sources are pre-scanned and any property beyond `Number.MAX_SAFE_INTEGER`
draws a dev-mode warning naming the feature and property.

**`<lr-heatmap>`: the matrix row-label gutter is configurable, and labels truncate.** It was a
hardcoded 60px with no measurement, so a longer row label was clipped mid-word by whatever was
painted beside it on the canvas — which reads as a rendering fault. `rowLabelWidth` now pins a
width or takes `'auto'` to measure the widest label and size to fit (floored at 60, capped at 40%
of the host so one label cannot squeeze out the cells it describes), `colLabelHeight` does the same
for the column band, and a label too wide for the resolved gutter is truncated with an ellipsis
instead of clipped. The default stays 60: auto-sizing every chart would silently reflow layouts
whose labels already fit, which is a bigger change than the clipping it fixes.
