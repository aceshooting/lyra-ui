---
"@aceshooting/lyra-ui": minor
---

`lyra-select` gains `--lyra-select-trigger-height`, unset (auto) by default -- when a consumer sets
it, the trigger resolves to exactly that height (both floor and cap) instead of only being
floored by `--lyra-select-trigger-min-height`, for pixel-matching a sibling form field in the same
row without a blunt `::part(trigger){block-size:...}` override.
