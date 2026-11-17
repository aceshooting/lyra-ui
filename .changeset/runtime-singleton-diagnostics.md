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

With the runtime diagnostic and lifecycle fixes included, the optional MapLibre v6 map bundle
measures 2,528,040 raw bytes across 52 files, up 335 bytes from 2,527,705. The optional graph
bundle measures 463,780 raw bytes across 14 files, up 922 bytes from 462,858. These are complete
emitted bundle measurements. Only their exceeded raw ceilings advance to the next 64-byte
boundaries: 2,528,064 bytes with 24 bytes of allowance for map, and 463,808 bytes with 28 bytes
for graph. The MapLibre v5 bundle remains below its existing ceiling. Gzip limits and peer-graph
checks remain unchanged.

Cursor-backed documents, custom ingestion presentation and actions, feedback detail limits,
quantity formatting and lifecycle fixes increase the complete installed core graph by 34,173 raw
bytes to 5,734,158 bytes across 65 files. Only the exceeded raw ceiling advances to 5,734,208
bytes, the next 64-byte boundary with 50 bytes of allowance. Gzip limits, optional-peer
exclusions and exact binary requirements remain unchanged.
