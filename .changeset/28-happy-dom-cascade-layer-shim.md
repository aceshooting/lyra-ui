---
"@aceshooting/lyra-ui": minor
---

`@aceshooting/lyra-ui/testing`: `installHappyDomShims()` now also installs `installHappyDomCascadeLayerShim()`, and both it and `flattenCascadeLayers(css)` are exported. Happy DOM 20 drops every rule inside an `@layer` block, so the probe properties Lyra's stylesheets declare in cascade layers never resolved: under a Vitest + Happy DOM suite `theme.css` looked absent, `setLyraStyle()` warned that a stylesheet was missing, and it took its no-stylesheet fallback. The shim unwraps layer blocks in the text `CSSStyleSheet.replaceSync()`/`replace()` parse (the path used by `<style>`, linked and constructed sheets), so the probes resolve as in a browser. Layer precedence is not modelled. The shim detects the defect, so it is a no-op in every browser, and it returns a function that restores the original methods. Install it in the same `setupFiles` entry, before any stylesheet is parsed.
