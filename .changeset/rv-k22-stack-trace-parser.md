---
"@aceshooting/lyra-ui": patch
---
`lr-stack-trace` keeps Python 3.11+ caret lines with their frame instead of the exception message, parses WebKit `global code`/`module code` frames, and drops the never-matching `'(native)'` default internal pattern.
