---
"@aceshooting/lyra-ui": patch
---
lr-markdown, lr-markdown-core: a raw `<a>` or `<area>` with a `target` now always gets `rel="noopener noreferrer"`, including when an earlier attribute value contains `>` or `rel` is repeated, because the guard now reads the parsed element instead of scanning the markup text.
