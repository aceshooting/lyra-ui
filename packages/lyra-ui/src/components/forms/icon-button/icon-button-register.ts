// Lean registration entry for `<lr-icon-button>`: it registers the tag and nothing else.
//
// `./icon-button.js` additionally imports `<lr-icon>`, because an `icon`/`src` attribute renders a
// nested `<lr-icon>` and that has to be registered synchronously -- the common case must not paint
// its glyph a frame late. A consumer who only ever slots their own SVG pays for that anyway: the
// icon implementation lands in the entry chunk, and `<lr-icon>`'s guarded remote-SVG loader drags
// in a dompurify chunk that such a consumer can never reach.
//
// This entry is the explicit opt-out. Import it INSTEAD of `./icon-button.js` when every icon
// button in the graph slots its content:
//
//   import '@aceshooting/lyra-ui/components/forms/icon-button/icon-button-register.js';
//
// Setting `icon`/`src` on a button registered this way renders nothing until `<lr-icon>` is
// registered by something else, which is the whole trade: an explicit, synchronous choice rather
// than a mount-time dynamic import that would make the common path asynchronous for everyone.
export * from './icon-button.class.js';
import { LyraIconButton } from './icon-button.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('icon-button', LyraIconButton);
