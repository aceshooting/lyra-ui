---
"@aceshooting/lyra-ui": minor
---

`<lr-map>`: add `legendCollapsible`/`legendOpen` and the cancelable `lr-map-legend-panel-toggle`.

The legend panel could not be collapsed at all, so a large key permanently covered part of the map.
`legend-collapsible` renders a native disclosure button inside the panel whose visible localized
text is its accessible name, whose `aria-expanded` renders the literal `"true"`/`"false"`, and whose
`aria-controls` names the row list in the same shadow root. `legendOpen` defaults **open**, so adding
only `legendCollapsible` never hides an existing key; it is a `true`-defaulting boolean, so
`legend-open="false"` parses and the open default reflects as an absent attribute.

Activation emits the cancelable `lr-map-legend-panel-toggle` (`detail: { open }`). `preventDefault()`
is a real veto — nothing is written and nothing re-renders — so a host can own the open state, and a
programmatic `legendOpen` assignment reconciles without emitting, so a controlled host cannot loop.
Collapsing hides the gradient, the rows, the `legend-limit` summary and the trailing `legend` slot;
the `legend-start` slot and the disclosure stay visible. New `legend-disclosure` and
`legend-disclosure-icon` parts. With `legendCollapsible` unset the rendered legend is unchanged.
