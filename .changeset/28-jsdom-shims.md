---
"@aceshooting/lyra-ui": minor
---

`@aceshooting/lyra-ui/testing` exports `installJsdomShims()` and `installJsdomAdoptedStyleSheetsShim()` for jsdom suites. jsdom has no `adoptedStyleSheets`, so Lit rendered one `<style>` per component shadow root; jsdom registers each of those sheets on the document, so every `getComputedStyle()` call matched against all of them (one consumer measured about 118 ms per call and 70–115 s per test with about 357 sheets). The shim adds an inert `adoptedStyleSheets` to `Document` and `ShadowRoot` so Lit adopts constructed stylesheets instead; adopted sheets are stored but never applied. It installs only under jsdom while `adoptedStyleSheets` is missing, is a no-op in browsers and Happy DOM, and returns a function that removes it. Call it in a `setupFiles` entry before anything imports Lit.
