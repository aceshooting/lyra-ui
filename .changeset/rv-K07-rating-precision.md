---
"@aceshooting/lyra-ui": patch
---
lr-rating: stepping or clicking with a fractional `precision` no longer leaks floating-point noise such as 0.30000000000000004 into `value`, `lr-change`, `aria-valuenow` and the submitted entry.
