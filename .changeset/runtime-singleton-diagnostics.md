---
'@aceshooting/lyra-ui': patch
---

Warn once per document when multiple active UI runtimes are detected, including copies with the
same package version. Document application-owned whole-package resolution for components,
utilities and lazy chunks. The diagnostic identifies unsupported split-runtime use without
merging overlay ownership or interrupting component operation.

The shared document-runtime diagnostic increases a standalone button registration from 36,507
to 37,120 gzip bytes (+613 bytes). Reviewed bundle measurements advance only the 21 exceeded
entry, aggregate and component-maximum ceilings to their smallest 64-byte boundary, leaving
0–63 bytes of allowance; the button canary has none. The eight passing measurement/ceiling
pairs, measurement options and optional-peer exclusions remain unchanged.

The runtime diagnostic, its overlay declaration and resolution/testing guides add 5,752 unpacked
package bytes. The actual archive measures 22,654,271 bytes and the npm dry-run estimate measures
22,654,893 across 3,291 files. Only the exceeded unpacked ceiling advances to 22,654,912 bytes,
the next 64-byte boundary with 19 bytes of allowance. All other byte limits, file-count ceilings
and the historical reduction policy remain unchanged.

The shared document-runtime diagnostic increases the complete installed core graph by 2,022 raw
bytes to 5,699,985 bytes across 65 files. The immutable package comparison identifies only six
runtime module payload changes, with no dependency changes. Only the exceeded core raw ceiling
advances to 5,700,032 bytes, the next 64-byte boundary with 47 bytes of allowance. Gzip limits,
optional-peer exclusions and exact binary requirements remain unchanged.

The same diagnostic adds 148 raw bytes to the optional MapLibre v6 map bundle, measuring
2,527,705 bytes across 52 files, and 1,795 raw bytes to the optional graph bundle, measuring
462,858 bytes across 14 files. Only their exceeded raw ceilings advance to the next 64-byte
boundaries: 2,527,744 bytes with 39 bytes of allowance for map, and 462,912 bytes with 54 bytes
for graph. The MapLibre v5 bundle remains below its existing ceiling. Gzip limits and peer-graph
checks remain unchanged.
