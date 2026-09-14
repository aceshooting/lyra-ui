export * from './code-block-core.class.js';
export type { ShikiLanguageInput } from './shiki-types.js';
import { LyraCodeBlockCore } from './code-block-core.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../overlays/skeleton/skeleton.js';
// The lean icon-button entry: the copy control slots this component's own label or glyph, so it
// must not drag lr-icon (and its unreachable sanitizer chunk) into a consumer's graph.
// policy-allow(component-dependency: lr-icon): this entry composes <lr-icon-button> through its
// LEAN registration entry, which deliberately registers only that tag. <lr-icon> is reachable from
// lr-icon-button's class module only when its `icon`/`src` attribute is set, and this component
// never sets either -- it slots the copy control's label or glyph instead. Registering <lr-icon>
// here would put the icon implementation plus its unreachable sanitizer chunk back into every
// consumer's graph, which is exactly what the lean entry exists to avoid -- see
// icon-button-register.ts's own header comment for the full trade.
import '../../forms/icon-button/icon-button-register.js';
defineElement('code-block-core', LyraCodeBlockCore);
