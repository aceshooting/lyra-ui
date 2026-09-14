export * from './reorder-item.class.js';
// The lean icon-button entry: the move controls slot this component's own chevron glyph, so they
// must not drag lr-icon (and its unreachable sanitizer chunk) into a consumer's graph.
// policy-allow(component-dependency: lr-icon): this entry composes <lr-icon-button> through its
// LEAN registration entry, which deliberately registers only that tag. <lr-icon> is reachable from
// lr-icon-button's class module only when its `icon`/`src` attribute is set, and this component
// never sets either -- it slots the move chevrons instead. Registering <lr-icon>
// here would put the icon implementation plus its unreachable sanitizer chunk back into every
// consumer's graph, which is exactly what the lean entry exists to avoid -- see
// icon-button-register.ts's own header comment for the full trade.
import '../../forms/icon-button/icon-button-register.js';
import { LyraReorderItem } from './reorder-item.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('reorder-item', LyraReorderItem);
