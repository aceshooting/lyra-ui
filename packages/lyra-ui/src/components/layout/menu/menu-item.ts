export * from './menu-item.class.js';
import { LyraMenuItem } from './menu-item.class.js';
import { defineElement } from '../../../internal/prefix.js';
// policy-allow(component-dependency: lr-menu): menu-item.class.ts renders a generated
// `<lr-menu part="submenu">` panel, but `import './menu.js'` here closes a registration cycle
// (menu.ts already imports menu-item.js) that check-import-cycles.mjs rejects outright. That panel
// only ever exists inside a menu -- `<lr-menu-item>` has no valid placement outside one -- and
// every entry that puts it there (menu.js, dropdown.js, dropdown-item.js) registers lr-menu.
defineElement('menu-item', LyraMenuItem);
