---
"@aceshooting/lyra-ui": minor
---

`<lr-switch>` and `<lr-checkbox>`: expose the row wrapper as a new `row` CSS part.

Both controls render the track/box owner and the rich label as *siblings* inside a wrapper element
that carried no `part` at all, while `base` names the owner box rather than the row. A consumer
laying out a column of switches therefore had no selector for "the row": `inline-size: 100%` on any
part inside it resolved against a shrink-to-fit parent, and because the owner box centers its track
and its width tracks the label's, a longer label shifted the track's x-position from row to row —
visibly ragged.

`row` names the real wrapper, so `::part(row)` can stretch or align it. `base`/`switch`/`wrapper`
and `base`/`checkbox` keep their existing nodes and meaning — they are documented Web Awesome /
Shoelace compatibility names, so repointing them would have broken shipped consumers. This is
purely additive; an unstyled control renders identically.
