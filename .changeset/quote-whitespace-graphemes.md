---
'@aceshooting/lyra-ui': patch
---

Keep text-quote searches consistent across inline element boundaries by collapsing whitespace before combining characters that expand during Unicode normalization.

Preserve emoji in Firefox when a UTF-16 surrogate pair is split across text nodes or streaming updates.

Normalize copied quotes after removing soft hyphens so accented text still matches its source.
