---
"@aceshooting/lyra-ui": minor
---

`<lr-streaming-text>`/`<lr-streaming-text-core>` now forward their composed
`<lr-markdown>`/`<lr-markdown-core>`'s documented CSS parts (`content`, `heading`, `paragraph`,
`list`, `code-block`, `inline-code`, `link`, `table`, `blockquote`, `img`, `math`) through
`exportparts`, reusing each name verbatim since none collides with either wrapper's own `base`/
`cursor` parts. A host-level `lr-streaming-text::part(link)`/`::part(img)` (or the `-core` variant's
equivalent) rule now reaches the rendered `<a>`/`<img>` the same way it already does applied
directly to `<lr-markdown>`/`<lr-markdown-core>` -- previously that styling surface was unreachable
from outside either wrapper's own shadow boundary.
