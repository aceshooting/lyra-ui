---
'@aceshooting/lyra-ui': patch
---

`lr-markdown` / `lr-streaming-text`: progressive rendering now closes a fenced code block only on a line that repeats the opening fence character, matching CommonMark and the complete parse. A line such as ` ```~ ` no longer ends a backtick fence early while streaming.
