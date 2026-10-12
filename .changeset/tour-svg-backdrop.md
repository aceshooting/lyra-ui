---
'@aceshooting/lyra-ui': patch
---

Restore the tour backdrop and spotlight cutout by rendering their shapes in the SVG namespace. Keep the spotlight aligned when its target resizes, and fill the backdrop when the target is missing.

Reuse one scrim, formatted progress text and scoped geometry lookups to reduce repeated rendering work. The corrected SVG rendering requires three additional gzip bytes in the complete registration bundle and four in the tour initial marginal bundle after these reductions. Their reviewed ceilings advance to exactly 1,269,107 and 18,769 bytes, with no additional allowance; other budgets and measurement inputs are unchanged.
