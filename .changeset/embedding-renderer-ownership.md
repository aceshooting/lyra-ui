---
'@aceshooting/lyra-ui': patch
---

Keep embedding renderer callbacks scoped to their current connection and inputs. Retired renderers stop startup, dispose exactly once even after a delayed mount, and cannot overwrite a replacement renderer or report its failure. A throwing peer disposer no longer interrupts cleanup.

The renderer ownership checks add 615 unpacked bytes to one runtime module; the public API and declarations remain unchanged. The archive contains 22,549,979 unpacked bytes in 3,289 files; npm estimates 22,550,601 bytes. The unpacked limit advances to the next 64-byte boundary, 22,550,656 bytes. Four aggregate gzip limits advance only to the next 64-byte boundary above their measured 1,482,741 / 1,708,228 / 1,708,030 / 1,729,721 bytes for all, CDN autoloader, autoloader and SSR all. Passing limits, bundle inputs and optional-peer exclusions remain unchanged.

The packed consumer's core bundle measures 5,670,392 raw bytes across the same 64 files. Its ceiling advances to 5,670,400 bytes, leaving eight bytes of headroom; the separate required Shiki binary measurement is unchanged.
