---
"@aceshooting/lyra-ui": minor
---

`<lr-icon-button>` gains a lean registration entry for slot-only consumers.

`components/forms/icon-button/icon-button.js` eagerly imports `<lr-icon>`, because an `icon`/`src`
attribute renders a nested `<lr-icon>` and that has to be registered synchronously — the common
case must not paint its glyph a frame late. A consumer who only ever slots their own SVG paid for
that anyway: `<lr-icon>`'s implementation landed in the entry chunk, and its guarded remote-SVG
loader dragged in a sanitizer chunk that such a consumer could never reach.

`components/forms/icon-button/icon-button-register.js` registers `<lr-icon-button>` and nothing
else. Import it instead of `icon-button.js` when every icon button in your graph slots its content:

```js
import '@aceshooting/lyra-ui/components/forms/icon-button/icon-button-register.js';
```

Setting `icon`/`src` on a button registered this way renders no glyph until `<lr-icon>` is
registered by something else — that is the whole trade, and it is why this is an explicit opt-out
rather than a mount-time dynamic import: a lazy import would have made the common path (an `icon`
attribute) asynchronous for everyone, risking flicker and layout shift on the most frequent usage
in order to help the rarer slot-only one. One caveat recorded honestly: the sanitizer chunk sits
behind a dynamic import, so it is deploy weight rather than first-paint weight — the real
first-paint saving is `<lr-icon>`'s own code leaving the entry chunk.

Every first-party component that composes an icon button internally (`<lr-copy-button>`,
`<lr-dialog>`, `<lr-drawer>`, `<lr-reorder-item>`, `<lr-message-actions>`,
`<lr-attachment-trigger>`, `<lr-code-block>`, `<lr-code-block-core>`, `<lr-callout>`) now uses this
entry, since each slots its own glyph — so their consumers get the saving without changing
anything.
