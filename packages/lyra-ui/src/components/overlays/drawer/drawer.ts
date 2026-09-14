// <lr-drawer> extends LyraDialog, so it inherits the dialog's built-in close control -- a composed
// <lr-icon-button> as of 16.0.0. Without this registration that control would render as an inert,
// never-upgrading element for a consumer importing only this module. The LEAN entry is the right
// one: the close glyph is slotted, never an `icon` attribute.
// policy-allow(component-dependency: lr-icon): see above -- lr-icon-button's own <lr-icon> is only
// reachable through its `icon`/`src` attribute, which the inherited close control never sets, so
// registering <lr-icon> here would ship the icon implementation plus its unreachable sanitizer
// chunk to every drawer consumer for nothing -- see icon-button-register.ts's own header comment
// for the full trade.
import '../../forms/icon-button/icon-button-register.js';
import { defineElement } from '../../../internal/prefix.js';
import { LyraDrawer } from './drawer.class.js';

defineElement('drawer', LyraDrawer);
export { LyraDrawer } from './drawer.class.js';
export type { LyraDrawerPlacement } from './drawer.class.js';
