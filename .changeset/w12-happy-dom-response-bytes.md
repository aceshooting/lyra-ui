---
'@aceshooting/lyra-ui': minor
---

`@aceshooting/lyra-ui/testing` adds `installHappyDomResponseBytesShim()`, and `installHappyDomShims()` now calls it: it supplies `Response.prototype.bytes()` where Happy DOM lacks it. Shiki's inlined Oniguruma engine, which `lr-code-block` loads on demand, calls `bytes()` as it imports, so Happy DOM suites no longer see an unhandled rejection per highlighter load.
