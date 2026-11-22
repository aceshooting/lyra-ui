---
'@aceshooting/lyra-ui': minor
---

`lyra-ui-migrate` now rewrites upstream `--wa-*` and `--sl-*` design-token references to `--lr-*` tokens through a reviewed route table instead of only reporting them. Semantic colour roles, surface, text, border, overlay and focus colours, border widths, font families and weights, and spacing steps with the same resolved value (`--wa-space-m` becomes `--lr-space-l`) are rewritten silently. Type sizes, radii, line heights, shadows, durations, easing and Shoelace `-600` palette steps rewrite to the nearest role and report `UPSTREAM_TOKEN_APPROXIMATE_REVIEW`. Tokens with no equivalent, such as `--wa-space-2xl` (2.5rem), are left as-is and reported as `UPSTREAM_TOKEN_REVIEW` with the nearest alternatives. A token the file declares itself is never rewritten.
