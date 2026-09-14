---
"@aceshooting/lyra-ui": patch
---

Documents why `<lr-icon-button>` has no `size` attribute, now that the shared six-step size ladder
reaches most of the library.

Its dimension is an accessibility floor, not a density dial. `--lr-icon-button-size` states the
minimum tappable target the whole library sizes its icon controls against, and the ladder's small
tiers sit at or under WCAG 2.5.8's 24px minimum (`2xs` resolves to 20px, `xs` to 24px), so wiring
the target to the ladder would let `size="2xs"` ship an untappable control — silently, because the
ladder is the mechanism every neighbouring control uses correctly. A smaller icon button therefore
stays an explicit, single-purpose decision: override `--lr-icon-button-size`, which reads as the
accessibility trade-off it is. Scaling the glyph inside that floor remains `--lr-icon-size`.
