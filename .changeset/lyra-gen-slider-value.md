---
"@aceshooting/lyra-gen": minor
---

The reviewed `slider` role accepts `withValue`, `withTooltip`, `tooltipPlacement` and a declarative `format` (`decimal`, `currency`, `percent` or an Intl unit, with fraction digits); the trusted adapter turns the format into a locale-bound `valueFormatter`, so generated sliders show and announce values such as "€200" or "80%" instead of a bare thumb and a raw number.
