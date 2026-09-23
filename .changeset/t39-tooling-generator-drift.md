---
'@aceshooting/lyra-ui': patch
---

Fixed the repository's dependency-upgrade and full-regeneration scripts so they reach every generated artifact contract-policy checks for freshness, and kept the pinned pnpm version they record in sync with the one an upgrade actually installs.
Hardened the Web Awesome/Shoelace migration-coverage check so an attribute-polarity comparison that examines zero pairs is treated as a bug instead of a silent pass.
Made `sideEffects` discovery for registration- and optional-peer-only modules behavior-based instead of filename-based, so a future side-effect-only module survives production tree-shaking regardless of its name.
