---
"@aceshooting/lyra-ui": patch
---

Corrected 14 documentation annotations that named **10.1.0**, a version that was never published.
Those members shipped in 11.0.0: the docs were written while the release was expected to be a
minor, the public-API semver gate then required a major, and nothing restamped the annotations.

This was worse than a typo. A consumer on 10.0.1 reading "new in 10.1.0" either installs a version
that does not exist, or assumes their 10.0.1 install already has the feature and debugs an
attribute that silently does nothing — Lit accepts an unknown attribute without error, so there is
no failure signal at all.

Also corrects the generated per-component "Optional peers" header, which attributed peers reached
only through an erased `import type`. `lr-lite-chart` was listed under all four Chart.js peers
despite existing precisely to avoid them, inverting the choice the component offers; the same fix
drops several other over-attributions (the d3 peers were credited to 12 tags and genuinely belong
to 2). Side-effect registration edges still count, so transitive peers are unaffected.
