---
'@aceshooting/lyra-ui': patch
---

Prevent key lookups from invoking data providers retired while their capabilities are being read. Replacing the source or disconnecting its host stops obsolete lookup work before the provider callback runs, while subsequent requests can use the current source normally.

The ownership checks add 136 unpacked UI bytes (22,537,981 total) and measure 1,481,547 gzip bytes for all, 1,706,122 for the autoloader, 508,100 for agent-tools, 1,727,580 for SSR all and 301,508 for the largest component. Only these exceeded byte ceilings advance to the next 64-byte boundary; measurement inputs and optional-peer exclusions remain fixed.

The packed core consumer adds 84 raw bytes across the same 64 files (5,665,853 total); its exceeded ceiling advances to 5,665,856 bytes, the next 64-byte boundary. Passing consumer limits and the separate explicit WASM requirement remain unchanged.
