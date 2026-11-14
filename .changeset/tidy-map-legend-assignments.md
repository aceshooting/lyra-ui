---
"@aceshooting/lyra-ui": patch
---

Preserve newer map legend, gradient, tick, hidden-category and style assignments when older caller-owned input reenters during normalization. Keep legend counts and visibility aligned with the winning input, and safely reject revoked tick arrays without preventing later updates. Assigning an explicit empty tick list now immediately removes already-rendered derived ticks.
