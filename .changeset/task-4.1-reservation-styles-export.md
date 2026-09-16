---
"@aceshooting/lyra-ui": minor
---

Added `@aceshooting/lyra-ui/reservations.styles.js`, exporting `reservationStyles: CSSResult` —
the same layout-shift reservations `reservations.css` declares, generated from that same source so
the two can never drift, but adoptable directly into a shadow root
(`static styles = [reservationStyles, css\`...\`]`, or
`shadowRoot.adoptedStyleSheets = [reservationStyles.styleSheet!]`). `reservations.css` is a
light-DOM stylesheet: `@import`-ing it at document scope cannot reach an `lr-*` element that a
consumer's own component renders inside its own shadow root, because a document stylesheet never
crosses a shadow boundary. This export is the fix for exactly that case, matching `theme.css`'s
existing `theme.js` runtime counterpart.
