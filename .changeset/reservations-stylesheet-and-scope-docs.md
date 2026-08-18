---
"@aceshooting/lyra-ui": minor
---

Ship an optional `reservations.css` stylesheet that prevents layout shift from lazy-upgrading
elements, and document the library's scope boundaries.

An undefined custom element is an inline box with no intrinsic size, so every `lr-*` in the initial
viewport contributes a reflow as its definition loads; components that additionally defer on an
optional peer (`lr-chart`, `lr-map`, `lr-flag`, `lr-flow-canvas`, `lr-knowledge-graph-explorer`)
can cost a second shift when the peer resolves. Each is individually well-behaved — the aggregate on
a first paint is what costs a Cumulative Layout Shift score. Until now every consumer derived its own
`:not(:defined)` sizing rules per component by measurement, and those rules rotted silently whenever
a component's default dimensions changed.

```css
@import "@aceshooting/lyra-ui/reservations.css";
```

- Reserves each component's intrinsic footprint before upgrade, styling **only** `:not(:defined)`
  elements inside an `@layer lr-reservations`, so it is inert the moment a definition upgrades and
  can never fight a component's own layout. No colors, no `:root` rules.
- Every reservation is expressed with the **same custom property and fallback token the component's
  own stylesheet uses** (`--lr-chart-height`/`--lr-size-280px`, `--lr-flag-aspect-ratio`,
  `--lr-form-control-height`, …). That is what makes it worth shipping rather than documenting
  measured pixels: the reservations track the components, and theming a component re-themes its
  reservation with it.
- Reservations target each component's *final* default size rather than its skeleton's, so a
  skeleton-to-content swap stays stable too.

`llms/shared.md` gains a matching CLS section with the hand-rolled equivalent for consumers who
prefer their own rules, plus a new **Scope: what this library does not provide** section stating the
boundaries explicitly — client-side routing (there is no router and no route outlet; the navigation
components expose active state as ordinary properties to be driven by the application's own router),
data fetching/state management, and form-submission orchestration.
