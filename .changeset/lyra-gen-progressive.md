---
"@aceshooting/lyra-gen": minor
---

Generated views can now render progressively while they stream. `createJsonViewStream({ progressive: true })` and the new `createProgressiveMarkupParser()` return a validated `partial` preview on `incomplete` pushes: the complete nodes received so far, with still-open containers closed and listed in `partialNodes`, and the unfinished trailing node left out rather than guessed. Previews only grow (a shown node keeps its identity), carry the surface and revision of the final commit, are spaced so validation work stays linear in the stream length, and stop at the first syntax defect; `finish()` returns exactly the result of a non-progressive stream. Lyra Markup also accepts `visible`, `checks`, `computes` and `a11y` node members.
