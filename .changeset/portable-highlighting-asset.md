---
'@aceshooting/lyra-ui': patch
---

Package the default syntax-highlighting engine's reviewed WebAssembly asset beside its lazy loader. Markdown and code components now build without an unresolved asset warning when the optional Shiki peer is absent. The asset is fetched only when default-engine highlighting is requested and Shiki is available; JavaScript-engine and plain-text rendering do not fetch it. Include the upstream licenses and artifact provenance with the binary.

The portable asset reference and optional-engine capability check add 20–75 gzip bytes to ten direct JavaScript entries, 41 bytes to the component percentile and 46 bytes to its maximum. After removing an unnecessary loader module, only those twelve breached bundle canaries advance to their exact measured bytes, with no added headroom. All passing ceilings, initial-route budgets, CSS budgets and optional-peer exclusions remain unchanged.

Packed consumer measurements include the reviewed 466,610-byte binary in their complete emitted-file totals. The core and code-block checks retain their existing non-asset ceilings and gain only that exact required-asset allowance; they also verify the emitted binary against the packaged asset, rejecting missing, changed, duplicate or additional WASM files. This does not grant extra JavaScript headroom. The package download grows by approximately 162 kB and remains within its unchanged delivery limits.
