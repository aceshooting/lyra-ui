---
"@aceshooting/lyra-ui": minor
---

`lr-sparkline`'s Lyra-only `area` CSS part and `--lr-sparkline-stroke-width` custom property are deprecated in favour of the mirrored `fill` part and `--line-width` property, with removal no earlier than 23.0.0. Both keep working unchanged until then: `area` stays on the same path as `fill`, and `--lr-sparkline-stroke-width` is still read as the fallback for `--line-width`, so it has no effect wherever `--line-width` is set. Migrate `::part(area)` rules to `::part(fill)`, and set `--line-width` on `lr-sparkline` itself (`lr-sparkline { --line-width: 2px; }`) rather than at the root, because the unprefixed name also reaches any other element that reads it. As styling hooks, neither alias logs a runtime warning.
