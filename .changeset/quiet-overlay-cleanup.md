---
'@aceshooting/lyra-ui': patch
---

Release deferred positioning and rectangle-tracking subscriptions when their owner is disposed from a synchronous setup callback. Repeated or reentrant disposal releases each subscription once, while retained placement sessions continue to support invalidation and geometry refresh.

The ownership checks add 108 unpacked package bytes and 55 raw bytes to the complete packed core bundle. Only exceeded package, core-consumer, library, and initial-route ceilings advance to the next 64-byte boundary above their recorded measurements, retaining all passing limits and optional-peer exclusions.
