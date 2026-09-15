---
"@aceshooting/lyra-ui": patch
---

The default Oniguruma engine that `<lr-code-block-core>`/`<lr-markdown-core>` (and the fine-grained
`languages` path of `<lr-code-block>`/`<lr-markdown>`) build their fenced-code highlighter with now
fetches the binary `shiki/onig.wasm` asset instead of importing `shiki/wasm`, the base64-inlined
module that specifier resolves to — roughly 82 KB gzip smaller and streaming-compilable. Also added
`setShikiCoreEngine('oniguruma' | 'javascript' | factory)`, letting a consumer opt into shiki's
pure-JS regex engine (no WebAssembly at all) or supply a pre-instantiated engine of their own; the
two engines never share a cached highlighter. This is an implementation detail with the same public
component API and smaller build output — no consumer action needed. A consumer who previously
aliased the internal `shiki/wasm` peer specifier directly should switch that alias to
`shiki/onig.wasm`, or call `setShikiCoreEngine('javascript')` to avoid WebAssembly entirely.
