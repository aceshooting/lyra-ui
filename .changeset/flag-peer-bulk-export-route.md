---
"@aceshooting/lyra-ui": patch
---

Added the missing package-export route for
`@aceshooting/lyra-ui/components/media/flag/flag-peer-bulk.js`. 11.2.0 led with that module as the
opt-in bulk peer-registration entry point for `<lr-flag>`, and `llms/components/lr-flag.md` and
`flag.class.d.ts` both told readers to import it — but it was never listed in `package.json`'s
`exports`, and an exports map blocks everything it does not list. Following the documentation was a
hard build error (`"…/flag-peer-bulk.js" is not exported under the conditions […]`), so the
release's headline `<lr-flag>` feature was unreachable by any consumer.

The derivation that exists to prevent exactly this — every `*-loader.ts` / `*-peer.ts` /
`*-register.ts` / `registry.ts` module must be explicitly classified as public or internal — missed
it because a *qualified* suffix (`-peer-bulk`) is not the bare suffix (`-peer`). The convention now
accepts qualified variants; across the whole source tree that widening catches this file and
nothing else.

A second, independent instance surfaced in the same sweep and is fixed too:
`@aceshooting/lyra-ui/components/data/flow-canvas/flow-types.js` is shown as an import in
`llms/data.md` and in the generated `llms/components/lr-flow-canvas.md`, and was likewise
unlisted. (Those types were still reachable through `flow-canvas.class.js`, so this adds the route
the docs already named rather than any new surface.)

Both were promises made in documentation, which no naming convention over the source tree can see.
So a new release gate, `check:doc-specifiers`, now reads the promises instead: every
`@aceshooting/lyra-ui/…` specifier a shipped file tells a reader to import must resolve through the
exports map. It understands prose instructions as well as fenced code examples — the
`flag-peer-bulk.js` promise was a sentence, not a code block.
