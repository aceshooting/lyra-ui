---
'@aceshooting/lyra-ui': minor
---

Add the shared optional size ladder to copy buttons. Keep viewport modals above ancestor stacking contexts and preserve their visual order across reconnects. Avoid redundant layout measurements and stale navigation-menu resize callbacks, and correct tooltip, sizing, and theme-contrast documentation.

Shared modal ordering and exit handling, allocation-preserving drawers, and copy-button sizing add runtime code; their required guides and generated editor data increase archive sizes. Only exceeded bundle and archive ceilings advance to the next 64-byte boundary after composition review; passing limits, measurement inputs and the UI download cap remain unchanged.

Make panorama pause-ownership qualification handle native callback delivery before the queued pause event, with deterministic coverage of both event orders.

Two compatible seven-sample Chromium quick comparisons against 30.3.0, run in opposite orders, retained 21 and 12 timing threshold exceedances. The second pair measured 10,000-row assignment median total time at 27.2 to 40.0 ms and chart-assignment p95 at 110.5 to 178.5 ms. All semantic checks and recorded work counts matched. Causes remain unresolved; neither pair is a performance pass. These advisory findings remain separate from passing preliminary hosted A/B qualification.
